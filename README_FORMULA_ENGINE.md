# Mini Coda 公式引擎

一个类似 Coda 的公式引擎实现，包含公式解析、执行、数据获取和 Action 支持。

## 🚀 快速开始

### 安装依赖（无需依赖）

本项目使用纯 Node.js 实现，无需安装任何外部依赖。

### 运行示例

```bash
node src/examples.js
```

或者使用 npm:

```bash
npm start
```

## 📁 项目结构

```
src/
├── model/
│   └── DataModel.js          # 数据模型（Grid, Column, Row, ControlGrid）
├── parser/
│   └── FormulaParser.js      # 公式解析器（词法分析 + 语法分析）
├── resolver/
│   └── Resolver.js           # 引用解析器（解析对象引用）
├── visitor/
│   └── ASTVisitor.js         # AST 访问器（遍历和求值）
├── executor/
│   └── FormulaExecutor.js    # 公式执行器（执行函数和 Action）
├── FormulaEngine.js          # 公式引擎（统一入口）
├── index.js                  # 模块导出
└── examples.js               # 完整示例
```

## 🎯 核心功能

### 1. 公式解析

将公式字符串解析为 AST（抽象语法树）：

```javascript
const { FormulaParser } = require('./parser/FormulaParser');

const parser = new FormulaParser();
const result = parser.parse('1 + 2 * 3');

console.log(result.ast);
// {
//   type: 'BinaryExpression',
//   operator: '+',
//   left: { type: 'Literal', value: 1 },
//   right: {
//     type: 'BinaryExpression',
//     operator: '*',
//     left: { type: 'Literal', value: 2 },
//     right: { type: 'Literal', value: 3 }
//   }
// }
```

### 2. 对象引用

支持类似 Coda 的对象引用语法：

```javascript
// Grid 引用
$$[grid:grid-employees:::false:false:员工数据库]

// Column 引用
$$[column:grid-employees:col-name::false:false:Name]

// ControlGrid 引用（会自动取值）
$$[controlGrid:ctrl-name:::false:false:NameInput]
```

### 3. 内置函数

#### 计算函数

- `Sum(a, b, c, ...)` - 求和
- `Average(a, b, c, ...)` - 平均值
- `Max(a, b, c, ...)` - 最大值
- `Min(a, b, c, ...)` - 最小值
- `Count(...)` - 计数
- `Concatenate(a, b, c, ...)` - 字符串拼接
- `If(condition, trueValue, falseValue)` - 条件判断

#### Action 函数

- `AddRow(grid, col1, val1, col2, val2, ...)` - 添加行
- `ModifyRows(grid, column, newValue)` - 修改所有行

### 4. 运算符

- 算术运算：`+`, `-`, `*`, `/`
- 比较运算：`==`, `!=`, `>`, `<`, `>=`, `<=`
- 括号：`(`, `)`

## 💻 使用示例

### 示例 1: 简单计算

```javascript
const { DocumentModel } = require('./src/model/DataModel');
const { FormulaEngine } = require('./src/FormulaEngine');

const doc = new DocumentModel();
const engine = new FormulaEngine(doc);

const result = engine.executeExpression('(10 + 20) * 2');
console.log(result.value); // 60
```

### 示例 2: 使用内置函数

```javascript
const result = engine.executeExpression('Sum(1, 2, 3, 4, 5)');
console.log(result.value); // 15

const result2 = engine.executeExpression('Average(10, 20, 30)');
console.log(result2.value); // 20

const result3 = engine.executeExpression('If(10 > 5, "大于", "小于")');
console.log(result3.value); // "大于"
```

### 示例 3: AddRow Action

```javascript
const { DocumentModel } = require('./src/model/DataModel');
const { FormulaEngine } = require('./src/FormulaEngine');

// 创建数据模型
const doc = new DocumentModel();
const grid = doc.createGrid('grid-1', '员工表');

// 添加列
const nameCol = doc.createColumn('col-name', 'Name');
const phoneCol = doc.createColumn('col-phone', 'Phone');
grid.addColumn(nameCol);
grid.addColumn(phoneCol);

// 创建输入控件
doc.createControl('ctrl-name', 'NameInput', '张三');
doc.createControl('ctrl-phone', 'PhoneInput', '13800138000');

// 执行 AddRow
const engine = new FormulaEngine(doc);
const formula = `AddRow(
  $$[grid:grid-1:::false:false:员工表],
  $$[column:grid-1:col-name::false:false:Name],
  $$[controlGrid:ctrl-name:::false:false:NameInput],
  $$[column:grid-1:col-phone::false:false:Phone],
  $$[controlGrid:ctrl-phone:::false:false:PhoneInput]
)`;

const result = engine.executeExpression(formula);
console.log(result.value);
// {
//   type: 'ActionResult',
//   success: true,
//   action: 'AddRow',
//   rowId: 'row-...',
//   row: { ... },
//   grid: { ... }
// }
```

### 示例 4: 对象引用

```javascript
// 创建控件
doc.createControl('ctrl-input', 'MyInput', 'Hello World');

// 获取控件值
const result = engine.executeExpression(
  '$$[controlGrid:ctrl-input:::false:false:MyInput]'
);
console.log(result.value); // "Hello World"

// 字符串拼接
const result2 = engine.executeExpression(
  'Concatenate("输入值: ", $$[controlGrid:ctrl-input:::false:false:MyInput])'
);
console.log(result2.value); // "输入值: Hello World"
```

## 🔧 API 文档

### FormulaEngine

#### `constructor(documentModel)`

创建公式引擎实例。

**参数:**
- `documentModel`: DocumentModel 实例

#### `executeExpression(formula, options)`

执行公式。

**参数:**
- `formula`: 公式字符串
- `options`: 可选配置
  - `verbose`: 是否输出详细日志（默认 false）

**返回:**
```javascript
{
  formula: string,      // 原始公式
  success: boolean,     // 是否成功
  value: any,          // 结果值
  error: string,       // 错误信息（如果失败）
  steps: Array         // 执行步骤
}
```

### DocumentModel

#### `createGrid(id, name)`

创建表格。

#### `createColumn(id, name, format)`

创建列。

#### `createControl(id, name, initialValue)`

创建控件。

#### `getObject(objectId)`

获取对象。

## 🎨 完整示例

运行 `node src/examples.js` 查看完整示例，包括：

1. **简单计算公式** - 基本算术运算
2. **内置函数** - Sum, Average, Max, Min, Concatenate, If, Count
3. **对象引用** - Grid, Column, ControlGrid 引用
4. **AddRow Action** - 添加行到表格
5. **ModifyRows Action** - 批量修改行
6. **详细执行过程** - Verbose 模式查看执行细节

## 📊 执行流程

```
公式字符串
    ↓
[Parser] 词法分析 + 语法分析
    ↓
AST (抽象语法树)
    ↓
[Visitor] 遍历 AST，解析引用
    ↓
[Resolver] 从 DocumentModel 获取对象
    ↓
求值后的参数
    ↓
[Executor] 执行函数/操作符
    ↓
结果
```

## 🌟 特性

- ✅ 完整的公式解析器（词法分析 + 语法分析）
- ✅ AST 生成和遍历
- ✅ 对象引用解析（Grid, Column, Row, ControlGrid）
- ✅ 内置函数支持（计算函数 + Action 函数）
- ✅ 操作符支持（算术 + 比较）
- ✅ Action 执行（AddRow, ModifyRows）
- ✅ 详细的错误处理
- ✅ Verbose 模式查看执行过程
- ✅ 无外部依赖，纯 Node.js 实现

## 🔍 调试

使用 verbose 模式查看详细执行过程：

```javascript
const result = engine.executeExpression(formula, { verbose: true });
```

这会输出：
- 解析后的 AST
- 求值过程
- 最终结果

## 📝 注意事项

1. 对象引用必须使用完整的格式：`$$[type:objectId:fieldId::false:false:displayName]`
2. ControlGrid 引用会自动返回 `value` 属性，而不是对象本身
3. Action 函数会修改数据模型，返回 ActionResult 对象
4. 计算函数不会修改数据，直接返回计算结果

## 🚧 扩展

### 添加新函数

在 `src/executor/FormulaExecutor.js` 的 `_registerFunctions` 方法中添加：

```javascript
MyFunction: {
  name: 'MyFunction',
  isAction: false, // 或 true
  execute: (args, resolver) => {
    // 实现函数逻辑
    return result;
  }
}
```

### 添加新数据类型

在 `src/model/DataModel.js` 中添加新的类。

## 📄 许可证

MIT

