# Coda Action 执行机制深度分析

> 虽然 Coda 没有独立的 `ActionEngine` 类，但有一套完整的 Action 执行系统

---

## 📋 目录

1. [Action 是什么](#1-action-是什么)
2. [Action vs 普通公式](#2-action-vs-普通公式)
3. [Action 执行流程](#3-action-执行流程)
4. [Action 的核心特性](#4-action-的核心特性)
5. [实际代码分析](#5-实际代码分析)
6. [Mini Coda 实现对比](#6-mini-coda-实现对比)

---

## 1. Action 是什么

### 1.1 定义

**Action** 是 Coda 中一类特殊的公式，它们的特点是：

- ✅ **会修改数据**（与只读的计算公式不同）
- ✅ **需要用户主动触发**（如点击按钮）
- ✅ **执行后会创建操作（Operation）**用于同步和撤销
- ✅ **可以触发依赖失效**，让其他公式重新计算

### 1.2 常见的 Action 公式

```javascript
// 1. AddRow - 添加行
AddRow(Table1, Column1, "value1", Column2, "value2")

// 2. ModifyRows - 修改行
ModifyRows(Table1.Filter(...), Column1, "newValue")

// 3. DeleteRows - 删除行
DeleteRows(Table1.Filter(...))

// 4. OpenUrl - 打开 URL
OpenUrl("https://example.com")

// 5. PushButton - 触发按钮
PushButton(Button1)

// 6. SetControlValue - 设置控件值
SetControlValue(Slider1, 50)
```

---

## 2. Action vs 普通公式

### 2.1 对比表格

| 特性 | 普通公式（Calculate） | Action 公式 |
|------|---------------------|------------|
| **执行时机** | 自动执行（依赖变化时） | 手动触发（按钮点击等） |
| **是否修改数据** | ❌ 否（只读） | ✅ 是（会修改） |
| **返回值** | 计算结果 | ActionResult 对象 |
| **是否创建 Operation** | ❌ 否 | ✅ 是 |
| **是否同步到服务器** | ❌ 否 | ✅ 是 |
| **是否可撤销** | ❌ 否 | ✅ 是 |
| **依赖追踪** | 自动追踪 | 不追踪（每次都是新操作） |
| **执行位置** | Worker 或主线程 | 主线程 |

### 2.2 示例对比

```javascript
// 普通公式 - 只读计算
const sumFormula = "Sum(Table1.Column1)";
// 特点：
// - 当 Table1.Column1 变化时自动重算
// - 不修改任何数据
// - 结果会被缓存

// Action 公式 - 修改数据
const addRowAction = "AddRow(Table1, Column1, 'value')";
// 特点：
// - 必须手动触发（如点击按钮）
// - 会在 Table1 中添加新行
// - 创建 BULK_ADD_ROW 操作
// - 同步到服务器
```

---

## 3. Action 执行流程

### 3.1 完整流程图

```
用户点击按钮
    ↓
Button Control 的 onClick 事件
    ↓
读取 control.action.formula
    ↓
═══════════════════════════════════════
Action 执行系统（不是独立的 Engine）
═══════════════════════════════════════
    ↓
[1] 标记为 Action
    isAction: true
    ↓
[2] 解析公式
    parse(formula) → AST
    ↓
[3] 验证函数类型
    getFunctionDefinition(name).isAction === true
    ↓
[4] 求值参数
    evaluateArguments(ast.arguments)
    ↓
[5] 执行 Action 函数
    executeAction(functionDef, args)
    ↓
    ┌─────────────────────────────────┐
    │ Action 函数内部逻辑              │
    ├─────────────────────────────────┤
    │ 1. 生成新数据（如新行 ID）        │
    │ 2. 创建操作对象（Operation）     │
    │    - type: 'BULK_ADD_ROW'       │
    │    - data: { ... }              │
    │ 3. 本地应用操作（乐观更新）        │
    │    - grid.rows[newRowId] = ...  │
    │ 4. 写入 UncommittedLog           │
    │ 5. 发送到服务器（WebSocket）     │
    └─────────────────────────────────┘
    ↓
[6] 触发依赖失效
    dependencyGraph.invalidate(affectedRefs)
    ↓
[7] 返回 ActionResult
    { success, rowId, operation }
    ↓
UI 更新
```

### 3.2 关键代码位置

基于实际分析，Action 执行分散在多个模块中，而不是独立的 Engine：

```javascript
// ========================================
// 位置 1: Button Control 触发
// 文件: postload.6f4c20e443c95cbdfd2e.chunk.js
// ========================================
class ButtonControl {
  handleClick() {
    const formula = this.props.control.action.formula;
    
    // 调用执行系统
    this.executeActions(formula, {
      isAction: true,  // 🔑 标记为 Action
      objectId: this.props.control.gridId
    });
  }
}

// ========================================
// 位置 2: 公式执行入口
// 文件: browser.6611b23ea80de0482abc.entry.js
// ========================================
async executeExpression(formula, context, options) {
  const { isAction = false } = options;
  
  // 如果是 Action，使用特殊处理
  if (isAction) {
    return this._executeActionFormula(formula, context);
  }
  
  // 否则作为普通公式处理
  return this._executeCalculateFormula(formula, context);
}

// ========================================
// 位置 3: Action 执行
// 文件: browser.6611b23ea80de0482abc.entry.js
// ========================================
async _executeActionFormula(formula, context) {
  // 1. 解析
  const ast = this.parser.parse(formula);
  
  // 2. 验证是 Action
  const funcDef = this.getFunctionDefinition(ast.name);
  if (!funcDef.isAction) {
    throw new Error(`${ast.name} is not an action`);
  }
  
  // 3. 求值参数
  const args = await this._evaluateArguments(ast.arguments, context);
  
  // 4. 执行 Action
  const result = await this._executeAction(funcDef, args, context);
  
  // 5. 触发依赖失效
  if (result.success) {
    this._invalidateDependencies(result.affectedObjects);
  }
  
  return result;
}

// ========================================
// 位置 4: 具体 Action 实现（AddRow）
// 文件: browser.6611b23ea80de0482abc.entry.js
// ========================================
async _executeAddRow(grid, columnValuePairs, context) {
  // 1. 生成新行 ID
  const newRowId = this._generateRowId();
  
  // 2. 构建行数据
  const rowData = {
    id: newRowId,
    values: {}
  };
  
  columnValuePairs.forEach(({ column, value }) => {
    rowData.values[column.id] = { value, timestamp: Date.now() };
  });
  
  // 3. 创建操作
  const operation = {
    type: 'BULK_ADD_ROW',
    objectId: grid.id,
    data: {
      rows: {
        [newRowId]: rowData
      }
    },
    timestamp: Date.now(),
    userId: context.currentUser.id
  };
  
  // 4. 本地应用（乐观更新）
  grid.rows[newRowId] = rowData;
  grid.tableStorage.setKeys(newRowId, rowData.values);
  
  // 5. 发送到服务器
  await context.document.syncEngine.pushOperation(operation);
  
  // 6. 返回结果
  return {
    success: true,
    rowId: newRowId,
    operation: operation
  };
}
```

---

## 4. Action 的核心特性

### 4.1 操作（Operation）创建

Action 执行后会创建操作对象：

```javascript
const operation = {
  // 操作类型
  type: 'BULK_ADD_ROW' | 'BULK_MODIFY_ROWS' | 'BULK_DELETE_ROWS' | ...,
  
  // 目标对象
  objectId: 'grid-xxx',
  
  // 操作数据
  data: {
    rows: {
      [rowId]: {
        rowNumber: number,
        values: { [columnId]: { value, timestamp } }
      }
    }
  },
  
  // 元数据
  timestamp: number,
  userId: string,
  
  // 撤销数据（用于 undo）
  undoData?: {
    previousValues: { ... }
  }
};
```

### 4.2 乐观更新（Optimistic Update）

Action 执行时采用**乐观更新**策略：

```javascript
async executeAction(action) {
  // 1. 立即在本地应用更改
  this._applyOperationLocally(operation);
  
  // 2. UI 立即更新（用户感觉很快）
  this._notifyUIUpdate();
  
  // 3. 在后台发送到服务器
  const promise = this._syncToServer(operation);
  
  // 4. 如果失败，回滚
  try {
    await promise;
  } catch (error) {
    this._rollbackOperation(operation);
    this._showError(error);
  }
}
```

### 4.3 UncommittedLog（未提交日志）

所有 Action 操作都会先写入 `UncommittedLog`：

```javascript
class UncommittedLog {
  private operations: Operation[] = [];
  
  // 添加操作
  push(operation: Operation) {
    this.operations.push(operation);
    this._persistToIndexedDB(operation);
  }
  
  // 确认操作（收到服务器 ACK）
  confirm(operationId: string) {
    const index = this.operations.findIndex(op => op.id === operationId);
    if (index >= 0) {
      this.operations.splice(index, 1);
      this._removeFromIndexedDB(operationId);
    }
  }
  
  // 获取待同步的操作
  getPendingOperations() {
    return this.operations;
  }
}
```

### 4.4 依赖失效触发

Action 执行后会触发相关公式重新计算：

```javascript
async executeAddRow(grid, ...) {
  // ... 执行 AddRow
  
  // 触发依赖失效
  this.dependencyGraph.invalidate({
    objectId: grid.id,
    type: 'row:added',
    rowId: newRowId
  });
  
  // 这会导致所有依赖此 Grid 的公式重新计算
  // 例如：Count(Table1)、Sum(Table1.Column)
}
```

---

## 5. 实际代码分析

### 5.1 Button Control 中的 Action

```javascript
// 从实际分析文档中提取的代码
{
  type: 'control',
  controlType: 'button',
  label: 'Add row',
  action: {
    formula: 'AddRow($$[grid:grid-xxx:::false:false:Table])',
    isAction: true  // 🔑 标记为 Action
  }
}
```

### 5.2 Action 函数定义

```javascript
// AddRow 的函数定义
const AddRowFunction = {
  name: 'AddRow',
  isAction: true,  // 🔑 标记为 Action 函数
  
  // 参数定义
  parameters: [
    { name: 'target', type: 'TableReference', required: true },
    { name: 'values', type: 'Object', required: false }
  ],
  
  // 执行函数
  async execute(args, context) {
    const grid = args[0];
    const columnValuePairs = args.slice(1);
    
    return await context._executeAddRow(grid, columnValuePairs);
  }
};
```

### 5.3 与 FormulaEngine 的集成

```javascript
class FormulaEngine {
  async executeExpression(formula, context, options) {
    const { isAction = false } = options;
    
    // 解析
    const ast = this.parse(formula);
    
    // 获取函数定义
    const funcDef = this.getFunctionDefinition(ast.name);
    
    // 🔑 区分 Action 和普通公式
    if (funcDef.isAction || isAction) {
      // Action 执行路径
      return this._executeAction(ast, context);
    } else {
      // 普通公式执行路径
      return this._executeCalculate(ast, context);
    }
  }
}
```

---

## 6. Mini Coda 实现对比

### 6.1 我们的实现

在我们创建的 Mini Coda 中，Action 也是作为公式系统的一部分：

```javascript
// src/executor/FormulaExecutor.js

AddRow: {
  name: 'AddRow',
  isAction: true,  // 🔑 标记为 Action
  
  execute: (args, resolver) => {
    const grid = args[0];
    
    // 解析参数
    const columnValuePairs = [];
    for (let i = 1; i < args.length; i += 2) {
      columnValuePairs.push({
        column: args[i],
        value: args[i + 1]
      });
    }
    
    // 生成新行
    const newRowId = `row-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // 构建数据
    const rowData = {
      id: newRowId,
      values: {}
    };
    
    columnValuePairs.forEach(pair => {
      rowData.values[pair.column.id] = pair.value;
    });
    
    // 添加到 Grid
    const row = grid.addRow(rowData);
    
    // 返回 ActionResult
    return {
      type: 'ActionResult',
      success: true,
      action: 'AddRow',
      rowId: newRowId,
      row: row,
      grid: grid
    };
  }
}
```

### 6.2 可以增强的功能

要让 Mini Coda 更接近真实的 Coda，可以添加：

1. **操作日志系统**
   ```javascript
   class OperationLog {
     operations = [];
     
     push(operation) {
       this.operations.push(operation);
     }
     
     undo() {
       const operation = this.operations.pop();
       this._rollback(operation);
     }
   }
   ```

2. **依赖失效触发**
   ```javascript
   class DependencyGraph {
     invalidate(objectId) {
       // 找到所有依赖此对象的公式
       const dependents = this.getDependents(objectId);
       
       // 触发重算
       dependents.forEach(ref => {
         this.markDirty(ref);
       });
     }
   }
   ```

3. **异步同步**
   ```javascript
   class SyncEngine {
     async pushOperation(operation) {
       // 1. 本地应用
       this._applyLocally(operation);
       
       // 2. 发送到服务器
       await this._sendToServer(operation);
     }
   }
   ```

---

## 7. 总结

### 7.1 核心要点

1. **没有独立的 ActionEngine**
   - Coda 没有单独的 `ActionEngine` 类
   - Action 是作为公式系统的一部分实现的
   - 通过 `isAction` 标志区分

2. **Action 的本质**
   - Action 就是 **会修改数据的特殊公式**
   - 通过 `isAction: true` 标记
   - 执行后创建 Operation 对象
   - 触发同步和依赖失效

3. **执行流程**
   - Button → onClick → executeActions
   - 解析 → 求值 → 执行 Action 函数
   - 创建 Operation → 本地应用 → 同步服务器
   - 触发依赖失效 → 相关公式重算

4. **与普通公式的区别**
   - 普通公式：只读、自动执行、可缓存
   - Action 公式：可写、手动触发、创建操作

### 7.2 架构设计启示

如果要构建类似系统，应该：

1. **统一的公式引擎**
   - 不需要单独的 ActionEngine
   - 在 FormulaEngine 中通过 `isAction` 区分

2. **操作日志系统**
   - UncommittedLog 管理未同步操作
   - 支持乐观更新和回滚

3. **依赖图集成**
   - Action 执行后触发依赖失效
   - 自动重算相关公式

4. **同步引擎**
   - 操作创建后异步同步
   - 支持离线和重连

---

## 8. 参考资料

- [Add Row 按钮实现分析](./add_row_button_real_implementation.md)
- [公式执行完整分析](./formula_execution_complete_analysis.md)
- [关键用户流程](./04_key_user_flows.md)
- [协同层深入分析](./03_collaboration_layer_deep_dive.md)

---

**结论**：Coda 没有独立的 `ActionEngine`，Action 是作为公式系统的一个特殊分支实现的，通过 `isAction` 标志和特殊的执行路径来处理数据修改、操作创建、同步和依赖失效等功能。

