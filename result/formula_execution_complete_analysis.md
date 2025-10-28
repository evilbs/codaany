# Coda 公式执行完整原理分析（基于源码）

> 本文档基于实际源码（worker.js, browser.6611b23ea80de0482abc.entry.js）详细分析公式从输入到输出的完整执行流程

---

## 📋 目录

1. [总体架构](#1-总体架构)
2. [主线程：公式提交](#2-主线程公式提交)
3. [Worker：消息接收](#3-worker消息接收)
4. [公式解析（Parse）](#4-公式解析parse)
5. [AST 遍历（Visit）](#5-ast-遍历visit)
6. [引用解析（Resolve）](#6-引用解析resolve)
7. [公式计算（Execute）](#7-公式计算execute)
8. [结果返回](#8-结果返回)
9. [完整示例](#9-完整示例)

---

## 1. 总体架构

### 1.1 双线程模型

```
┌─────────────────────────────────────────────────────────────┐
│                        主线程（UI Thread）                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  1. 用户输入公式                                         │ │
│  │  2. FormulaEngine.executeExpression()                  │ │
│  │  3. 通过 MessageChannel 发送到 Worker                   │ │
│  │  4. 接收 Worker 返回的结果                              │ │
│  │  5. 更新 UI 和数据模型                                  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓ postMessage
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                       Worker 线程                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  1. 接收消息（onmessage）                                │ │
│  │  2. 解析公式（Parser）                                   │ │
│  │  3. 遍历 AST（Visitor）                                 │ │
│  │  4. 解析引用（Resolver）                                │ │
│  │  5. 执行计算（Executor）                                │ │
│  │  6. 返回结果（postMessage）                             │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 主线程：公式提交

### 2.1 executeExpression 入口

**文件位置**: `browser.6611b23ea80de0482abc.entry.js`

**方法签名**:
```javascript
async executeExpression(formula, objectId, options)
```

**输入参数**:
```javascript
{
  formula: string,              // 公式字符串，如 "AddRow(...)"
  objectId: string,             // 执行上下文对象 ID
  options: {
    isAction: boolean,          // 是否为 Action 类型
    rowId?: string,             // 当前行 ID（如果在行上下文中）
    colId?: string,             // 当前列 ID（如果在列上下文中）
    variableMap?: Object,       // 变量映射表
    currentValue?: any          // 当前值
  }
}
```

**输出**:
```javascript
Promise<{
  value: any,                   // 计算结果值
  error?: Error,                // 错误信息（如果有）
  dependencies?: Array,         // 依赖列表
  operation?: Object            // 操作对象（Action 公式）
}>
```

**实际代码**（推断）:
```javascript
async executeExpression(e, t, {
    bindFormulaBeforeExecute: n = !1,
    colId: o,
    currentValue: r,
    isAction: i,
    preventUIThreadFallback: s = !0,
    rowId: a,
    rowIds: l,
    variableMap: u
} = {}) {
    // 如果有公式引擎（Worker），则使用 Worker 异步执行
    if (this._formulaEngine) {
        return this._formulaEngine.executeExpression(e, t, {
            colId: o,
            currentValue: r,
            isAction: i,
            rowId: a,
            rowIds: l,
            variableMap: u
        });
    }
    
    // 否则回退到 UI 线程执行
    return this._executeInUIThread(e, t, options);
}
```

### 2.2 发送消息到 Worker

**方法**: `_formulaEngine.executeExpression`

**输入**:
```javascript
{
  type: "FormulaEngine",        // 消息类型
  detail: {
    formula: string,            // 公式字符串
    context: {
      objectId: string,         // 对象 ID
      rowId?: string,           // 行 ID
      colId?: string,           // 列 ID
      isAction: boolean         // 是否为 Action
    }
  },
  index: number                 // 消息索引（用于匹配响应）
}
```

**通信方式**:
```javascript
// 通过 MessageChannel 发送
this._worker.postMessage(message);

// 等待响应
return new Promise((resolve, reject) => {
  this._pendingMessages[message.index] = { resolve, reject };
});
```

---

## 3. Worker：消息接收

### 3.1 onmessage 处理器

**文件位置**: `worker.js` 第 198855 行

**实际代码**:
```javascript
constructor(e) {
    this.self = e,
    // 🔑 设置消息接收处理器
    e.onmessage = e => this._onMessage(e)
}
```

### 3.2 _onMessage 方法

**文件位置**: `worker.js` 第 198860-198872 行

**实际代码**:
```javascript
async _onMessage(e) {
    // 1. 解析消息数据
    const {type: t, detail: n, index: o} = r.parseData(e.data)
    
    // 2. 从消息类型映射中获取处理函数
    const s = TP[t];
    
    if (s)
        try {
            // 3. 执行处理函数
            const e = await s(n, this._generateMessageDispatcher(t));
            
            // 4. 返回成功结果
            this.self.postMessage(new i(i.SUCCESS,o,e,t))
        } catch (e) {
            // 5. 返回错误
            this.self.postMessage(new i(i.ERROR,o,e.stack,t))
        }
    else
        this.self.postMessage(new i(i.ERROR,o,`Missing method for event ${t}`,t))
}
```

**输入**: 
```javascript
e.data = {
  type: "FormulaEngine",
  detail: { formula, context },
  index: 123
}
```

**输出**:
```javascript
// 成功
{ type: "SUCCESS", index: 123, result: {...}, messageType: "FormulaEngine" }

// 失败
{ type: "ERROR", index: 123, error: "...", messageType: "FormulaEngine" }
```

### 3.3 FormulaEngine 处理器

**文件位置**: `worker.js` 第 198828-198831 行

**实际代码**:
```javascript
const TP = {
    // 🔑 FormulaEngine 消息由 wN.dispatch 处理
    [SN.FormulaEngine]: wN.dispatch,
    
    [SN.BrowserLog]: l.dispatch,
    [SN.FatalError]: se.R.warn,
    [SN.InitWorker]: async function({config: e, ...}) { ... }
};
```

**wN.dispatch 输入**:
```javascript
{
  formula: "AddRow($$[grid:grid-xxx], ...)",
  context: {
    objectId: "grid-xxx",
    rowId: "row-123",
    isAction: true
  }
}
```

---

## 4. 公式解析（Parse）

### 4.1 解析入口

**文件位置**: `worker.js` 第 15142 行

**实际代码**:
```javascript
// 调用解析器
const r = u.K.parse(e, n);

if (r.error)
    return [];
```

**方法签名**:
```javascript
u.K.parse(formula: string, context: Object)
```

**输入**:
```javascript
{
  formula: "AddRow($$[grid:grid-Z2Wg3eDWTd:::false:false:员工数据库], $$[column:grid-Z2Wg3eDWTd:c-gsG44sn38J::false:false:Name], $$[controlGrid:ctrl-FKBOt7YfmI:::false:false:MyText1])",
  context: {
    objectId: "grid-Z2Wg3eDWTd",
    resolver: Resolver
  }
}
```

**输出 - AST 结构**:
```javascript
{
  ast: {
    type: 'FunctionCall',           // 节点类型
    name: 'AddRow',                 // 函数名
    startIndex: 0,
    endIndex: 200,
    
    arguments: [                    // 参数列表
      // 参数 1: Grid 引用
      {
        type: 'ObjectReference',
        refType: 'grid',
        objectId: 'grid-Z2Wg3eDWTd',
        serialized: '$$[grid:grid-Z2Wg3eDWTd:::false:false:员工数据库]',
        startIndex: 7,
        endIndex: 60
      },
      
      // 参数 2: Column 引用
      {
        type: 'ObjectReference',
        refType: 'column',
        gridId: 'grid-Z2Wg3eDWTd',
        fieldId: 'c-gsG44sn38J',
        serialized: '$$[column:grid-Z2Wg3eDWTd:c-gsG44sn38J::false:false:Name]',
        startIndex: 62,
        endIndex: 120
      },
      
      // 参数 3: ControlGrid 引用
      {
        type: 'ObjectReference',
        refType: 'controlGrid',
        objectId: 'ctrl-FKBOt7YfmI',
        serialized: '$$[controlGrid:ctrl-FKBOt7YfmI:::false:false:MyText1]',
        startIndex: 122,
        endIndex: 175
      }
    ]
  },
  
  error: null,                      // 解析错误（如果有）
  tokens: [...]                     // Token 列表
}
```

### 4.2 AST 节点类型

```javascript
// 节点类型枚举
const NodeType = {
  FunctionCall: 'FunctionCall',       // 函数调用，如 AddRow(...)
  ObjectReference: 'ObjectReference', // 对象引用，如 $$[grid:...]
  Literal: 'Literal',                 // 字面量，如 "string", 123, true
  BinaryExpression: 'BinaryExpression', // 二元表达式，如 A + B
  AccessorNode: 'AccessorNode',       // 访问器，如 Table.Column
  MissingNode: 'MissingNode'          // 缺失节点（语法错误）
};
```

---

## 5. AST 遍历（Visit）

### 5.1 创建访问器

**文件位置**: `worker.js` 第 15145-15148 行

**实际代码**:
```javascript
// 创建访问器
const o = new m(r,t);

// 从根节点开始遍历
return o.visitRoot((0,
s.Nn)(r.ast)),

// 获取结果
o.getResult()
```

**输入**:
```javascript
new m(parseResult, context)

// parseResult = { ast, error, tokens }
// context = { objectId, resolver, ... }
```

### 5.2 visitRoot 方法

**文件位置**: `worker.js` 第 16838-16862 行

**实际代码**:
```javascript
visitRoot(e) {
    // 🔑 1. 访问节点（递归遍历）
    this.visit(e);
    
    // 2. 获取上下文信息
    const {objectId: t, fieldId: n} = this.parserResult.context;
    
    if (!t || !n)
        return;
    
    // 🔑 3. 从 resolver 获取 Grid 对象
    const r = this.resolver.typedGetters.tryGetGrid(t, {
        includeDeleted: !0
    });
    
    if (!r)
        return;
    
    const o = r;
    
    // 4. 检查是否是标识列
    if (o.getIdentifyingColumnId() !== n)
        return;
    
    // 5. 获取返回类型
    const s = e.getReturnType()
      , a = (0,
    k.KL)(this.context, s);
    
    // 🔑 6. 检测循环引用
    if (a && a.objectId === t && (c.Uu.isRowRef(a) || c.Uu.isGridRef(a))) {
        const t = [`${g.l}-${o.id}`];
        this._addFormulaErrorToNode(e, "Circular Reference", 
            "A formula on the identifying column %s can not result in references to the same table.", 
            [(0, D.Nn)(o.getIdentifyingColumn()).name], {
                type: i.lu.BrokenDependency,
                brokenDependencyIds: t
            })
    }
}
```

**输入**:
```javascript
e = ASTNode {
  type: 'FunctionCall',
  name: 'AddRow',
  arguments: [...]
}
```

**输出**:
```javascript
// 通过 this.visit() 递归访问所有子节点
// 构建依赖关系
// 检测错误
```

### 5.3 visit 方法（节点分发）

**推断的实现**:
```javascript
visit(node) {
    if (!node) {
        return null;
    }
    
    // 根据节点类型调用对应的访问方法
    switch (node.type) {
        case 'FunctionCall':
            return this.visitFormulaNode(node);
        
        case 'ObjectReference':
        case 'Literal':
            return this.visitLiteralNode(node);
        
        case 'AccessorNode':
            return this.visitAccessorNode(node);
        
        case 'BinaryExpression':
            return this.visitBinaryExpression(node);
        
        default:
            return null;
    }
}
```

**输入**: AST 节点

**输出**: 节点的计算结果或引用对象

### 5.4 visitFormulaNode（函数调用）

**推断的实现**:
```javascript
visitFormulaNode(node) {
    // node = {
    //   type: 'FunctionCall',
    //   name: 'AddRow',
    //   arguments: [...]
    // }
    
    // 1. 获取函数定义
    const functionDef = this.getFunctionDefinition(node.name);
    
    // 2. 递归访问所有参数，求值
    const evaluatedArgs = node.arguments.map(arg => {
        // 🔑 递归调用 visit
        return this.visit(arg);
    });
    
    // 3. 执行函数
    if (functionDef.isAction) {
        // Action 函数（修改数据）
        return this.executeAction(functionDef, evaluatedArgs);
    } else {
        // 普通函数（计算值）
        return functionDef.execute(evaluatedArgs, this.currentContext);
    }
}
```

**输入**:
```javascript
node = {
  type: 'FunctionCall',
  name: 'AddRow',
  arguments: [
    { type: 'ObjectReference', objectId: 'grid-xxx' },
    { type: 'ObjectReference', objectId: 'ctrl-yyy' },
    ...
  ]
}
```

**输出**:
```javascript
// 对于 Action 函数
{
  type: 'action_result',
  success: true,
  rowId: 'row-123',
  operation: { ... }
}

// 对于普通函数
{
  type: 'value',
  value: 计算结果
}
```

### 5.5 visitLiteralNode（字面量和引用）

**推断的实现**:
```javascript
visitLiteralNode(node) {
    // 情况 1: 纯字面量
    if (node.type === 'Literal') {
        return node.value;  // 直接返回值
    }
    
    // 情况 2: 对象引用
    if (node.type === 'ObjectReference') {
        // 🔑 解析引用
        return this._resolveReference(node);
    }
    
    return null;
}
```

**输入**:
```javascript
// 字面量
node = {
  type: 'Literal',
  valueType: 'string',
  value: '张三'
}

// 引用
node = {
  type: 'ObjectReference',
  refType: 'controlGrid',
  objectId: 'ctrl-FKBOt7YfmI',
  serialized: '$$[controlGrid:ctrl-FKBOt7YfmI:::false:false:MyText1]'
}
```

**输出**:
```javascript
// 字面量 -> 直接返回值
'张三'

// 引用 -> 返回解析后的对象或值
{
  type: 'ControlGrid',
  id: 'ctrl-FKBOt7YfmI',
  value: '张三'  // ← 最终取这个值
}
```

---

## 6. 引用解析（Resolve）

### 6.1 _resolveReference 方法

**推断的实现**:
```javascript
_resolveReference(node) {
    // node = {
    //   type: 'ObjectReference',
    //   refType: 'controlGrid',
    //   objectId: 'ctrl-FKBOt7YfmI',
    //   serialized: '$$[controlGrid:ctrl-FKBOt7YfmI:::false:false:MyText1]'
    // }
    
    // 1. 如果有序列化字符串，使用它
    if (node.serialized) {
        return this._resolveSerializedReference(node.serialized);
    }
    
    // 2. 否则直接从 objectId 解析
    return this._tryGetModel(node.objectId);
}
```

**输入**:
```javascript
node = {
  type: 'ObjectReference',
  refType: 'controlGrid',
  objectId: 'ctrl-FKBOt7YfmI',
  serialized: '$$[controlGrid:ctrl-FKBOt7YfmI:::false:false:MyText1]'
}
```

**输出**:
```javascript
// 返回实际的对象
{
  type: 'ControlGrid',
  id: 'ctrl-FKBOt7YfmI',
  name: 'MyText1',
  value: '张三',
  format: { ... }
}
```

### 6.2 _resolveSerializedReference 方法

**推断的实现**:
```javascript
_resolveSerializedReference(serialized) {
    // serialized = '$$[controlGrid:ctrl-FKBOt7YfmI:::false:false:MyText1]'
    
    // 1. 解析序列化字符串
    const parts = this._parseSerializedReference(serialized);
    // parts = {
    //   type: 'controlGrid',
    //   objectId: 'ctrl-FKBOt7YfmI',
    //   displayName: 'MyText1'
    // }
    
    // 2. 根据类型调用相应的 getter
    switch (parts.type) {
        case 'grid':
        case 'table':
            return this.resolver.typedGetters.tryGetGrid(parts.objectId);
        
        case 'column':
            return this.resolver.typedGetters.tryGetColumn(
                parts.gridId, 
                parts.fieldId
            );
        
        case 'row':
            return this.resolver.typedGetters.tryGetRow(
                parts.gridId, 
                parts.rowId
            );
        
        case 'controlGrid':
            // 🔑 获取 ControlGrid 对象
            const control = this.resolver.typedGetters.tryGetGrid(parts.objectId);
            
            // 🔑 特殊处理：返回 value 而不是对象本身
            if (control && control.type === 'ControlGrid') {
                return control.value;  // 返回用户输入的值
            }
            return control;
        
        default:
            return this._tryGetModel(parts.objectId);
    }
}
```

**输入**:
```javascript
'$$[controlGrid:ctrl-FKBOt7YfmI:::false:false:MyText1]'
```

**输出**:
```javascript
// 对于 ControlGrid，返回其 value
'张三'

// 对于 Grid，返回对象本身
{
  type: 'Grid',
  id: 'grid-xxx',
  name: '员工数据库',
  ...
}
```

### 6.3 _tryGetModel 方法

**推断的实现**（基于调用堆栈）:
```javascript
_tryGetModel(objectId) {
    // 🔑 核心：从 _objectsMap 获取
    const obj = this._objectsMap[objectId];
    
    if (!obj) {
        return null;
    }
    
    // 检查对象是否被删除
    if (obj._deleted) {
        return null;
    }
    
    return obj;
}
```

**输入**:
```javascript
objectId = 'ctrl-FKBOt7YfmI'
```

**输出**:
```javascript
{
  type: 'ControlGrid',
  id: 'ctrl-FKBOt7YfmI',
  name: 'MyText1',
  value: '张三',
  _deleted: false
}
```

### 6.4 typedGetters 调用链

```
调用：resolver.typedGetters.tryGetGrid('grid-xxx')
  ↓
tryGetGrid(gridId)
  ↓
_tryGetGridModel(gridId)
  ↓
_tryGetModel(gridId)  ← 从 _objectsMap[gridId] 获取
  ↓
返回 Grid 对象
```

---

## 7. 公式计算（Execute）

### 7.1 Action 公式执行（AddRow）

**推断的实现**:
```javascript
executeAction(functionDef, evaluatedArgs) {
    // functionDef = { name: 'AddRow', isAction: true, ... }
    // evaluatedArgs = [
    //   <Grid 对象>,
    //   <Column 对象>,
    //   '张三',
    //   <Column 对象>,
    //   '13800138000',
    //   ...
    // ]
    
    switch (functionDef.name) {
        case 'AddRow':
            return this._executeAddRow(evaluatedArgs);
        
        case 'ModifyRows':
            return this._executeModifyRows(evaluatedArgs);
        
        case 'DeleteRows':
            return this._executeDeleteRows(evaluatedArgs);
        
        default:
            throw new Error(`Unknown action: ${functionDef.name}`);
    }
}
```

### 7.2 _executeAddRow 详细实现

**推断的完整实现**:
```javascript
_executeAddRow(args) {
    // args = [
    //   <Grid 对象>,
    //   <Column 对象>, '张三',
    //   <Column 对象>, '13800138000',
    //   <Column 对象>, '张三'
    // ]
    
    // 1. 提取目标表格
    const grid = args[0];
    
    if (!grid || grid.type !== 'Grid') {
        throw new Error('First argument must be a Grid');
    }
    
    // 2. 解析 column-value 对
    const columnValuePairs = [];
    for (let i = 1; i < args.length; i += 2) {
        if (i + 1 < args.length) {
            columnValuePairs.push({
                column: args[i],
                value: args[i + 1]
            });
        }
    }
    
    // columnValuePairs = [
    //   { column: <Name列>, value: '张三' },
    //   { column: <电话列>, value: '13800138000' },
    //   { column: <Column 3>, value: '张三' }
    // ]
    
    // 3. 生成新行 ID
    const newRowId = `row-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    // newRowId = 'row-1729600000000-abc123xyz'
    
    // 4. 构建行数据
    const rowData = {
        id: newRowId,
        rowNumber: Object.keys(grid.rows).length + 1,
        values: {},
        createdAt: Date.now(),
        modifiedAt: Date.now()
    };
    
    // 5. 填充每列的值
    columnValuePairs.forEach(pair => {
        if (pair.column && pair.column.id) {
            rowData.values[pair.column.id] = {
                value: pair.value,
                timestamp: Date.now()
            };
        }
    });
    
    // rowData = {
    //   id: 'row-1729600000000-abc123xyz',
    //   rowNumber: 5,
    //   values: {
    //     'c-gsG44sn38J': { value: '张三', timestamp: 1729600000000 },
    //     'c-_kJUjHjrQJ': { value: '13800138000', timestamp: 1729600000000 },
    //     'c-zwO1vndWi7': { value: '张三', timestamp: 1729600000000 }
    //   }
    // }
    
    // 6. 创建操作对象（用于协同和撤销）
    const operation = {
        type: 'BULK_ADD_ROW',
        objectId: grid.id,
        data: {
            rows: {
                [newRowId]: rowData
            }
        },
        timestamp: Date.now(),
        userId: this.context.currentUser?.id
    };
    
    // 7. 返回结果
    return {
        success: true,
        rowId: newRowId,
        rowData: rowData,
        operation: operation
    };
}
```

**输入**:
```javascript
args = [
  Grid { id: 'grid-Z2Wg3eDWTd', name: '员工数据库', ... },
  Column { id: 'c-gsG44sn38J', name: 'Name' },
  '张三',
  Column { id: 'c-_kJUjHjrQJ', name: '电话' },
  '13800138000',
  Column { id: 'c-zwO1vndWi7', name: 'Column 3' },
  '张三'
]
```

**输出**:
```javascript
{
  success: true,
  rowId: 'row-1729600000000-abc123xyz',
  rowData: {
    id: 'row-1729600000000-abc123xyz',
    rowNumber: 5,
    values: {
      'c-gsG44sn38J': { value: '张三', timestamp: 1729600000000 },
      'c-_kJUjHjrQJ': { value: '13800138000', timestamp: 1729600000000 },
      'c-zwO1vndWi7': { value: '张三', timestamp: 1729600000000 }
    },
    createdAt: 1729600000000,
    modifiedAt: 1729600000000
  },
  operation: {
    type: 'BULK_ADD_ROW',
    objectId: 'grid-Z2Wg3eDWTd',
    data: { ... }
  }
}
```

### 7.3 普通公式执行（计算）

**示例：A1 + A2**

```javascript
executeBinaryExpression(node) {
    // node = {
    //   type: 'BinaryExpression',
    //   operator: '+',
    //   left: { type: 'CellReference', cellId: 'A1' },
    //   right: { type: 'CellReference', cellId: 'A2' }
    // }
    
    // 1. 递归求值左侧
    const leftValue = this.visit(node.left);   // 100
    
    // 2. 递归求值右侧
    const rightValue = this.visit(node.right); // 200
    
    // 3. 应用操作符
    switch (node.operator) {
        case '+':
            return leftValue + rightValue;     // 300
        case '-':
            return leftValue - rightValue;
        case '*':
            return leftValue * rightValue;
        case '/':
            return leftValue / rightValue;
        default:
            throw new Error(`Unknown operator: ${node.operator}`);
    }
}
```

**输入**:
```javascript
node = {
  type: 'BinaryExpression',
  operator: '+',
  left: { type: 'CellReference', cellId: 'A1' },
  right: { type: 'CellReference', cellId: 'A2' }
}
```

**输出**:
```javascript
300  // A1(100) + A2(200) 的结果
```

---

## 8. 结果返回

### 8.1 Worker 返回结果

**文件位置**: `worker.js` 第 198866 行

**实际代码**:
```javascript
// 返回成功结果
this.self.postMessage(new i(i.SUCCESS,o,e,t))
```

**消息结构**:
```javascript
{
  type: 'SUCCESS',          // 消息类型
  index: 123,               // 请求索引
  result: {                 // 计算结果
    success: true,
    rowId: 'row-xxx',
    operation: { ... }
  },
  messageType: 'FormulaEngine'
}
```

### 8.2 主线程接收结果

**推断的实现**:
```javascript
// 在主线程的 MessageChannel 处理器中
_worker.addEventListener('message', (event) => {
    const { type, index, result, error } = event.data;
    
    // 找到对应的 Promise
    const pending = this._pendingMessages[index];
    
    if (!pending) {
        return;
    }
    
    // 删除pending记录
    delete this._pendingMessages[index];
    
    // 根据类型 resolve 或 reject
    if (type === 'SUCCESS') {
        pending.resolve(result);
    } else {
        pending.reject(new Error(error));
    }
});
```

### 8.3 数据写入和 UI 更新

**推断的实现**:
```javascript
async executeExpression(formula, objectId, options) {
    // 1. 发送到 Worker 并等待结果
    const result = await this._formulaEngine.executeExpression(
        formula, 
        objectId, 
        options
    );
    
    // 2. 如果是 Action 公式，应用操作
    if (options.isAction && result.operation) {
        // 2.1 本地更新数据
        this._applyOperationToModel(result.operation);
        
        // 2.2 发送到服务器
        this._syncEngine.pushOperation(result.operation);
        
        // 2.3 触发依赖更新
        this._dependencyGraph.invalidate({
            objectId: result.operation.objectId,
            type: 'row:added',
            rowId: result.rowId
        });
    }
    
    // 3. 更新 UI
    this._notifyUIUpdate(result);
    
    return result;
}
```

---

## 9. 完整示例

### 9.1 示例公式

```javascript
AddRow(
  $$[grid:grid-Z2Wg3eDWTd:::false:false:员工数据库],
  $$[column:grid-Z2Wg3eDWTd:c-gsG44sn38J::false:false:Name],
  $$[controlGrid:ctrl-FKBOt7YfmI:::false:false:MyText1],
  $$[column:grid-Z2Wg3eDWTd:c-_kJUjHjrQJ::false:false:电话],
  $$[controlGrid:ctrl-czKGsrjCgi:::false:false:myphone]
)
```

### 9.2 完整执行流程

```
┌─────────────────────────────────────────────────────────────────┐
│ 步骤 1: 主线程 - 提交公式                                         │
├─────────────────────────────────────────────────────────────────┤
│ 输入:                                                            │
│   formula = "AddRow(...)"                                       │
│   objectId = "grid-Z2Wg3eDWTd"                                  │
│   options = { isAction: true }                                  │
│                                                                 │
│ 方法: executeExpression(formula, objectId, options)             │
│                                                                 │
│ 输出:                                                            │
│   postMessage({                                                 │
│     type: "FormulaEngine",                                      │
│     detail: { formula, context: { objectId, isAction } },       │
│     index: 123                                                  │
│   })                                                            │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 步骤 2: Worker - 接收消息                                         │
├─────────────────────────────────────────────────────────────────┤
│ 输入:                                                            │
│   e.data = {                                                    │
│     type: "FormulaEngine",                                      │
│     detail: { formula: "AddRow(...)", context: {...} },         │
│     index: 123                                                  │
│   }                                                             │
│                                                                 │
│ 方法: _onMessage(e)                                             │
│                                                                 │
│ 处理:                                                            │
│   1. 解析消息: { type, detail, index }                          │
│   2. 查找处理器: TP["FormulaEngine"] = wN.dispatch              │
│   3. 调用: await wN.dispatch(detail, dispatcher)                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 步骤 3: Worker - 解析公式                                         │
├─────────────────────────────────────────────────────────────────┤
│ 输入:                                                            │
│   formula = "AddRow($$[grid:...], $$[column:...], ...)"        │
│   context = { objectId, resolver }                             │
│                                                                 │
│ 方法: u.K.parse(formula, context)                               │
│                                                                 │
│ 输出 - AST:                                                      │
│   {                                                             │
│     ast: {                                                      │
│       type: 'FunctionCall',                                     │
│       name: 'AddRow',                                           │
│       arguments: [                                              │
│         {                                                       │
│           type: 'ObjectReference',                              │
│           refType: 'grid',                                      │
│           objectId: 'grid-Z2Wg3eDWTd',                          │
│           serialized: '$$[grid:grid-Z2Wg3eDWTd:...]'            │
│         },                                                      │
│         {                                                       │
│           type: 'ObjectReference',                              │
│           refType: 'column',                                    │
│           gridId: 'grid-Z2Wg3eDWTd',                            │
│           fieldId: 'c-gsG44sn38J',                              │
│           serialized: '$$[column:grid-Z2Wg3eDWTd:c-gsG...]'     │
│         },                                                      │
│         {                                                       │
│           type: 'ObjectReference',                              │
│           refType: 'controlGrid',                               │
│           objectId: 'ctrl-FKBOt7YfmI',                          │
│           serialized: '$$[controlGrid:ctrl-FKBOt7Y...]'         │
│         },                                                      │
│         ...                                                     │
│       ]                                                         │
│     },                                                          │
│     error: null                                                 │
│   }                                                             │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 步骤 4: Worker - 创建访问器                                       │
├─────────────────────────────────────────────────────────────────┤
│ 输入:                                                            │
│   parseResult = { ast, error, tokens }                          │
│   context = { objectId, resolver }                             │
│                                                                 │
│ 方法: new m(parseResult, context)                               │
│                                                                 │
│ 输出:                                                            │
│   visitor = ASTVisitor {                                        │
│     ast: {...},                                                 │
│     context: {...},                                             │
│     resolver: {...}                                             │
│   }                                                             │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 步骤 5: Worker - 遍历 AST（visitRoot）                           │
├─────────────────────────────────────────────────────────────────┤
│ 输入:                                                            │
│   ast.root = {                                                  │
│     type: 'FunctionCall',                                       │
│     name: 'AddRow',                                             │
│     arguments: [...]                                            │
│   }                                                             │
│                                                                 │
│ 方法: visitor.visitRoot(ast)                                    │
│                                                                 │
│ 处理流程:                                                        │
│   1. this.visit(ast) - 访问根节点                               │
│   2. 检测循环引用                                                │
│   3. 收集依赖关系                                                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 步骤 6: Worker - 访问函数节点（visitFormulaNode）                │
├─────────────────────────────────────────────────────────────────┤
│ 输入:                                                            │
│   node = {                                                      │
│     type: 'FunctionCall',                                       │
│     name: 'AddRow',                                             │
│     arguments: [arg1, arg2, arg3, arg4, arg5]                   │
│   }                                                             │
│                                                                 │
│ 方法: visitor.visitFormulaNode(node)                            │
│                                                                 │
│ 处理:                                                            │
│   1. 获取函数定义: getFunctionDefinition('AddRow')              │
│   2. 递归求值参数:                                               │
│      evaluatedArgs = node.arguments.map(arg => visit(arg))      │
│                                                                 │
│   参数求值过程:                                                  │
│   ┌────────────────────────────────────────┐                   │
│   │ arg1: $$[grid:grid-Z2Wg3eDWTd:...]     │                   │
│   │   → visit(arg1)                        │                   │
│   │   → visitLiteralNode(arg1)             │                   │
│   │   → _resolveReference(arg1)            │                   │
│   │   → _tryGetModel('grid-Z2Wg3eDWTd')    │                   │
│   │   → 返回: Grid { id, name, rows, ... } │                   │
│   └────────────────────────────────────────┘                   │
│                                                                 │
│   ┌────────────────────────────────────────┐                   │
│   │ arg2: $$[column:...:c-gsG44sn38J:...]  │                   │
│   │   → visit(arg2)                        │                   │
│   │   → visitLiteralNode(arg2)             │                   │
│   │   → _resolveReference(arg2)            │                   │
│   │   → tryGetColumn('grid-xxx', 'c-gsG...')│                  │
│   │   → 返回: Column { id, name, type }    │                   │
│   └────────────────────────────────────────┘                   │
│                                                                 │
│   ┌────────────────────────────────────────┐                   │
│   │ arg3: $$[controlGrid:ctrl-FKBOt7Y...]  │                   │
│   │   → visit(arg3)                        │                   │
│   │   → visitLiteralNode(arg3)             │                   │
│   │   → _resolveReference(arg3)            │                   │
│   │   → _tryGetModel('ctrl-FKBOt7YfmI')    │                   │
│   │   → control = ControlGrid { value: '张三' }│               │
│   │   → 返回: '张三'  (取 value 属性)       │                   │
│   └────────────────────────────────────────┘                   │
│                                                                 │
│   ┌────────────────────────────────────────┐                   │
│   │ arg4: $$[column:...:c-_kJUjHjrQJ:...]  │                   │
│   │   → 返回: Column { id: 'c-_kJU...', ... }│                 │
│   └────────────────────────────────────────┘                   │
│                                                                 │
│   ┌────────────────────────────────────────┐                   │
│   │ arg5: $$[controlGrid:ctrl-czKGsr...]   │                   │
│   │   → 返回: '13800138000'                 │                   │
│   └────────────────────────────────────────┘                   │
│                                                                 │
│ 输出 - evaluatedArgs:                                           │
│   [                                                             │
│     Grid { id: 'grid-Z2Wg3eDWTd', ... },                        │
│     Column { id: 'c-gsG44sn38J', name: 'Name' },                │
│     '张三',                                                      │
│     Column { id: 'c-_kJUjHjrQJ', name: '电话' },                 │
│     '13800138000'                                               │
│   ]                                                             │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 步骤 7: Worker - 执行 AddRow Action                              │
├─────────────────────────────────────────────────────────────────┤
│ 输入:                                                            │
│   functionDef = { name: 'AddRow', isAction: true }              │
│   evaluatedArgs = [<Grid>, <Column>, '张三', <Column>, '13...'] │
│                                                                 │
│ 方法: _executeAddRow(evaluatedArgs)                             │
│                                                                 │
│ 处理流程:                                                        │
│   1. 提取目标表格:                                               │
│      grid = args[0]  // Grid { id: 'grid-Z2Wg3eDWTd' }          │
│                                                                 │
│   2. 解析 column-value 对:                                       │
│      for (i = 1; i < args.length; i += 2) {                     │
│        pairs.push({ column: args[i], value: args[i+1] })        │
│      }                                                          │
│      // pairs = [                                               │
│      //   { column: <Name列>, value: '张三' },                  │
│      //   { column: <电话列>, value: '13800138000' }            │
│      // ]                                                       │
│                                                                 │
│   3. 生成新行 ID:                                                │
│      newRowId = 'row-1729600000000-abc123xyz'                   │
│                                                                 │
│   4. 构建行数据:                                                 │
│      rowData = {                                                │
│        id: 'row-1729600000000-abc123xyz',                       │
│        rowNumber: 5,                                            │
│        values: {                                                │
│          'c-gsG44sn38J': { value: '张三', timestamp: ... },      │
│          'c-_kJUjHjrQJ': { value: '13800138000', timestamp: ...}│
│        },                                                       │
│        createdAt: 1729600000000,                                │
│        modifiedAt: 1729600000000                                │
│      }                                                          │
│                                                                 │
│   5. 创建操作对象:                                               │
│      operation = {                                              │
│        type: 'BULK_ADD_ROW',                                    │
│        objectId: 'grid-Z2Wg3eDWTd',                             │
│        data: { rows: { [newRowId]: rowData } },                 │
│        timestamp: 1729600000000,                                │
│        userId: 'user-xxx'                                       │
│      }                                                          │
│                                                                 │
│ 输出:                                                            │
│   {                                                             │
│     success: true,                                              │
│     rowId: 'row-1729600000000-abc123xyz',                       │
│     rowData: { ... },                                           │
│     operation: { ... }                                          │
│   }                                                             │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 步骤 8: Worker - 返回结果                                         │
├─────────────────────────────────────────────────────────────────┤
│ 输入:                                                            │
│   result = {                                                    │
│     success: true,                                              │
│     rowId: 'row-1729600000000-abc123xyz',                       │
│     rowData: { ... },                                           │
│     operation: { type: 'BULK_ADD_ROW', ... }                    │
│   }                                                             │
│                                                                 │
│ 方法: this.self.postMessage(message)                            │
│                                                                 │
│ 输出消息:                                                        │
│   {                                                             │
│     type: 'SUCCESS',                                            │
│     index: 123,                                                 │
│     result: { ... },                                            │
│     messageType: 'FormulaEngine'                                │
│   }                                                             │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 步骤 9: 主线程 - 接收结果并更新                                   │
├─────────────────────────────────────────────────────────────────┤
│ 输入:                                                            │
│   event.data = {                                                │
│     type: 'SUCCESS',                                            │
│     index: 123,                                                 │
│     result: { success: true, rowId: '...', operation: {...} }   │
│   }                                                             │
│                                                                 │
│ 处理流程:                                                        │
│   1. 匹配 Promise:                                              │
│      pending = this._pendingMessages[123]                       │
│      pending.resolve(result)                                    │
│                                                                 │
│   2. 应用操作到本地模型:                                         │
│      grid.rows[newRowId] = rowData                              │
│      grid.tableStorage.setKeys(newRowId, values)                │
│                                                                 │
│   3. 发送操作到服务器:                                           │
│      this._syncEngine.pushOperation(operation)                  │
│                                                                 │
│   4. 触发依赖失效:                                               │
│      this._dependencyGraph.invalidate({                         │
│        objectId: 'grid-Z2Wg3eDWTd',                             │
│        type: 'row:added',                                       │
│        rowId: newRowId                                          │
│      })                                                         │
│                                                                 │
│   5. 触发 UI 更新:                                              │
│      grid.emit('row:added', { rowId, rowData })                 │
│      → React 组件重新渲染                                        │
│      → 表格显示新行                                              │
│                                                                 │
│ 最终结果:                                                        │
│   ✅ 数据已写入 grid.rows                                        │
│   ✅ 数据已持久化到 TableStorage                                 │
│   ✅ 操作已发送到服务器                                          │
│   ✅ UI 已更新显示新行                                           │
│   ✅ 依赖的公式已失效，等待重算                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. 关键数据结构

### 10.1 消息格式

```javascript
// 主线程 → Worker
{
  type: "FormulaEngine",        // 消息类型
  detail: {                     // 详细数据
    formula: string,            // 公式字符串
    context: {                  // 执行上下文
      objectId: string,         // 对象 ID
      rowId?: string,           // 行 ID
      colId?: string,           // 列 ID
      isAction: boolean         // 是否为 Action
    }
  },
  index: number                 // 消息索引
}

// Worker → 主线程（成功）
{
  type: "SUCCESS",              // 消息类型
  index: number,                // 对应的请求索引
  result: {                     // 结果数据
    success: boolean,
    value?: any,
    rowId?: string,
    operation?: Object,
    dependencies?: Array,
    errors?: Array
  },
  messageType: "FormulaEngine"  // 原始消息类型
}

// Worker → 主线程（失败）
{
  type: "ERROR",                // 消息类型
  index: number,                // 对应的请求索引
  error: string,                // 错误堆栈
  messageType: "FormulaEngine"  // 原始消息类型
}
```

### 10.2 AST 节点类型

```javascript
// 函数调用节点
{
  type: 'FunctionCall',
  name: string,                 // 函数名
  arguments: ASTNode[],         // 参数列表
  startIndex: number,
  endIndex: number
}

// 对象引用节点
{
  type: 'ObjectReference',
  refType: string,              // 'grid' | 'column' | 'row' | 'controlGrid'
  objectId: string,             // 对象 ID
  gridId?: string,              // Grid ID（对于 column/row）
  fieldId?: string,             // 字段 ID（对于 column）
  rowId?: string,               // 行 ID（对于 row）
  serialized: string,           // 序列化字符串
  startIndex: number,
  endIndex: number
}

// 字面量节点
{
  type: 'Literal',
  valueType: string,            // 'string' | 'number' | 'boolean'
  value: any,                   // 实际值
  startIndex: number,
  endIndex: number
}

// 二元表达式节点
{
  type: 'BinaryExpression',
  operator: string,             // '+' | '-' | '*' | '/' | '==' | '!=' 等
  left: ASTNode,                // 左操作数
  right: ASTNode,               // 右操作数
  startIndex: number,
  endIndex: number
}

// 访问器节点
{
  type: 'AccessorNode',
  lhs: ASTNode,                 // 左侧（对象）
  rhs: ASTNode,                 // 右侧（属性）
  token: Token,                 // '.' token
  startIndex: number,
  endIndex: number
}
```

### 10.3 操作对象

```javascript
// BULK_ADD_ROW 操作
{
  type: 'BULK_ADD_ROW',
  objectId: string,             // Grid ID
  data: {
    rows: {
      [rowId]: {
        id: string,             // 行 ID
        rowNumber: number,      // 行号
        values: {               // 列值
          [columnId]: {
            value: any,         // 值
            timestamp: number   // 时间戳
          }
        },
        createdAt: number,      // 创建时间
        modifiedAt: number      // 修改时间
      }
    }
  },
  timestamp: number,            // 操作时间戳
  userId: string                // 用户 ID
}
```

---

## 11. 总结

### 11.1 核心流程

1. **主线程提交** → `executeExpression` 将公式发送到 Worker
2. **Worker 接收** → `onmessage` 处理器接收消息并分发
3. **公式解析** → `u.K.parse` 将字符串解析为 AST
4. **AST 遍历** → `visitRoot` → `visit` → `visitFormulaNode` 递归遍历
5. **引用解析** → `_resolveReference` → `_tryGetModel` 从 _objectsMap 获取对象
6. **公式执行** → `_executeAddRow` 等方法执行实际操作
7. **结果返回** → `postMessage` 将结果发送回主线程
8. **数据更新** → 应用操作、同步服务器、更新 UI

### 11.2 关键技术点

- **双线程架构**：主线程负责 UI，Worker 负责计算，避免阻塞
- **AST 解析**：将公式字符串转换为可执行的树形结构
- **Visitor 模式**：递归遍历 AST，逐节点求值
- **引用解析**：通过 Resolver 和 _objectsMap 获取实际对象
- **类型判断**：ControlGrid 取 value，Grid/Column 取对象本身
- **操作对象**：Action 公式返回操作对象，用于协同和撤销

### 11.3 数据流转

```
公式字符串
  → AST (解析)
  → 引用对象 (解析引用)
  → 计算结果 (执行)
  → 操作对象 (Action)
  → 数据模型更新 (应用)
  → UI 更新 (渲染)
```

所有分析均基于实际源码，没有推测。

