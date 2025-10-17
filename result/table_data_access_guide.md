# Coda 表格数据访问指南

## 问题背景

在 Coda 的文档结构中，你可能会看到 Slate Block Tree 中有 `type: "Table"` 的节点：

```javascript
{
  id: "table-GPDECroKmX",
  type: "Table",
  style: "H2",
  lineLevel: 0,
  alignment: "Left",
  children: [{...}]
}
```

**重要概念**：这个节点只是一个**引用**，实际的表格数据（行、列、单元格值）存储在 `Grid` 系统中。

---

## 🎯 快速访问方法

### 方法 1: 通过 Table ID 直接访问

```javascript
// 步骤 1: 获取 Table ID
const tableId = "table-GPDECroKmX";  // 从 Slate node 获取

// 步骤 2: 访问 Grid
const grid = window.coda.documentModel.grids.tryGetById(tableId);

// 步骤 3: 查看基本信息
console.log('Grid ID:', grid.id);
console.log('Grid Name:', grid.name);
console.log('Column Count:', grid.columns.count);
console.log('Row Count:', grid.rows.count);
```

### 方法 2: 使用 Resolver（推荐）

```javascript
const resolver = window.coda.documentModel.session.resolver;
const grid = resolver.typedGetters.tryGetGrid("table-GPDECroKmX");

if (grid) {
  console.log('Grid found:', grid);
} else {
  console.log('Grid not found');
}
```

---

## 📋 完整的表格数据访问示例

### 示例 1: 读取表格所有数据

```javascript
// 1. 获取表格
const tableId = "table-GPDECroKmX";
const grid = window.coda.documentModel.grids.tryGetById(tableId);

// 2. 获取列信息
console.log('=== 列信息 ===');
const columnIds = grid.columns.getIds();
const columns = columnIds.map(colId => {
  const column = grid.columns.getById(colId);
  return {
    id: column.id,
    name: column.name,
    type: column.type,
    formula: column.formula
  };
});
console.table(columns);

// 3. 获取行数据
console.log('=== 行数据 ===');
const rowIds = grid.rows.getIds();
rowIds.forEach((rowId, index) => {
  console.log(`\n--- Row ${index + 1} (ID: ${rowId}) ---`);
  
  columnIds.forEach(colId => {
    const column = grid.columns.getById(colId);
    const cellValue = grid.getCellValue(rowId, colId);
    
    console.log(`  ${column.name}: `, cellValue?.value);
  });
});
```

### 示例 2: 读取特定单元格

```javascript
// 获取第一行第一列的值
const firstRowId = grid.rows.getIds()[0];
const firstColId = grid.columns.getIds()[0];

const cellValue = grid.getCellValue(firstRowId, firstColId);
console.log('Cell value:', cellValue);

// CellValue 结构:
// {
//   value: "实际值",
//   rawValue: "原始值",
//   display: "显示文本",
//   error: null/Error
// }
```

### 示例 3: 遍历整个表格（类似 Excel）

```javascript
function printTable(tableId) {
  const grid = window.coda.documentModel.grids.tryGetById(tableId);
  if (!grid) {
    console.log('Table not found');
    return;
  }
  
  const columnIds = grid.columns.getIds();
  const rowIds = grid.rows.getIds();
  
  // 打印表头
  const headers = columnIds.map(colId => {
    const col = grid.columns.getById(colId);
    return col.name;
  });
  console.log(headers.join('\t'));
  console.log('─'.repeat(80));
  
  // 打印每一行
  rowIds.forEach(rowId => {
    const rowData = columnIds.map(colId => {
      const cellValue = grid.getCellValue(rowId, colId);
      return cellValue?.value ?? '';
    });
    console.log(rowData.join('\t'));
  });
}

// 使用
printTable("table-GPDECroKmX");
```

---

## 🗂️ Grid 对象的完整结构

```javascript
const grid = window.coda.documentModel.grids.tryGetById(tableId);

// Grid 对象包含:
{
  // 基本信息
  id: "table-GPDECroKmX",
  name: "My Table",
  type: "Grid",
  
  // 列管理器
  columns: {
    count: 5,
    getIds(): string[],
    getById(id: string): Column,
    tryGetById(id: string): Column | undefined,
    // ...
  },
  
  // 行管理器
  rows: {
    count: 10,
    getIds(): string[],
    getById(id: string): Row,
    tryGetById(id: string): Row | undefined,
    // ...
  },
  
  // 视图管理器（可能有多个视图）
  views: {
    getIds(): string[],
    getById(id: string): View,
    // ...
  },
  
  // 核心方法
  getCellValue(rowId: string, columnId: string): CellValue,
  setCellValue(rowId: string, columnId: string, value: any): void,
  
  // 其他属性
  parent: Page,
  document: DocumentModel,
  isLocked: boolean,
  isSyncTable: boolean,
  // ...
}
```

---

## 🔍 查找表格的多种方式

### 方式 1: 从当前页面查找所有表格

```javascript
function getAllTablesInCurrentPage() {
  const activePage = window.coda.documentModel.pagesManager.activePage;
  const tables = [];
  
  function traverse(node) {
    if (node.type === 'Table') {
      const grid = window.coda.documentModel.grids.tryGetById(node.id);
      if (grid) {
        tables.push({
          slateNodeId: node.id,
          grid: grid,
          name: grid.name
        });
      }
    }
    
    if (node.children) {
      node.children.forEach(child => traverse(child));
    }
  }
  
  traverse(activePage.canvas.slate.root);
  return tables;
}

// 使用
const tables = getAllTablesInCurrentPage();
console.log('Found tables:', tables);
tables.forEach(t => {
  console.log(`Table: ${t.name}, Rows: ${t.grid.rows.count}, Cols: ${t.grid.columns.count}`);
});
```

### 方式 2: 从整个文档查找所有表格

```javascript
function getAllTablesInDocument() {
  const grids = [];
  const gridIds = window.coda.documentModel.grids.getIds();
  
  gridIds.forEach(gridId => {
    const grid = window.coda.documentModel.grids.getById(gridId);
    grids.push({
      id: grid.id,
      name: grid.name,
      rowCount: grid.rows.count,
      columnCount: grid.columns.count,
      pageId: grid.parent?.id
    });
  });
  
  return grids;
}

// 使用
const allGrids = getAllTablesInDocument();
console.table(allGrids);
```

### 方式 3: 通过表格名称查找

```javascript
function findTableByName(tableName) {
  const gridIds = window.coda.documentModel.grids.getIds();
  
  for (const gridId of gridIds) {
    const grid = window.coda.documentModel.grids.getById(gridId);
    if (grid.name === tableName) {
      return grid;
    }
  }
  
  return null;
}

// 使用
const myTable = findTableByName("Sales Data");
if (myTable) {
  console.log('Found table:', myTable);
}
```

---

## 📊 Column（列）对象详解

```javascript
const grid = window.coda.documentModel.grids.tryGetById(tableId);
const columnId = grid.columns.getIds()[0];
const column = grid.columns.getById(columnId);

// Column 对象包含:
{
  id: "c-xyz123",
  name: "Product Name",
  
  // 列类型
  type: "Text" | "Number" | "Date" | "Select" | "Person" | "Lookup" | "Formula" | ...,
  
  // 列配置
  format: {
    type: "Text",
    // 不同类型有不同的格式配置
  },
  
  // 如果是公式列
  formula: "=SUM([Price] * [Quantity])",
  
  // 列宽度
  width: 150,
  
  // 是否隐藏
  hidden: false,
  
  // 访问方法
  getParent(): Grid,
  getCellValue(rowId: string): CellValue,
  // ...
}
```

### 常见列类型示例

```javascript
// 1. 文本列
{
  type: "Text",
  format: { type: "Text" }
}

// 2. 数字列
{
  type: "Number",
  format: {
    type: "Number",
    precision: 2,
    useThousandsSeparator: true
  }
}

// 3. 选择列（Select）
{
  type: "Select",
  format: {
    type: "Select",
    options: ["Option 1", "Option 2", "Option 3"]
  }
}

// 4. 公式列
{
  type: "Formula",
  formula: "=[Column1] + [Column2]",
  resultType: "Number"
}

// 5. Lookup 列（关联其他表格）
{
  type: "Lookup",
  format: {
    type: "Lookup",
    targetGridId: "grid-abc123",
    displayColumn: "c-display"
  }
}
```

---

## 🔄 Row（行）对象详解

```javascript
const grid = window.coda.documentModel.grids.tryGetById(tableId);
const rowId = grid.rows.getIds()[0];
const row = grid.rows.getById(rowId);

// Row 对象包含:
{
  id: "r-abc123",
  index: 0,  // 在表格中的位置
  
  // 访问单元格值
  getCellValue(columnId: string): CellValue,
  
  // 行元数据
  createdAt: Date,
  modifiedAt: Date,
  createdBy: "user-123",
  
  // 行高度（如果自定义）
  height: undefined | number,
  
  // 访问方法
  getParent(): Grid,
  // ...
}
```

### 读取行数据的多种方式

```javascript
const grid = window.coda.documentModel.grids.tryGetById(tableId);
const rowId = grid.rows.getIds()[0];

// 方式 1: 通过 grid.getCellValue
const columnId = grid.columns.getIds()[0];
const cellValue1 = grid.getCellValue(rowId, columnId);

// 方式 2: 通过 row.getCellValue
const row = grid.rows.getById(rowId);
const cellValue2 = row.getCellValue(columnId);

// 方式 3: 通过 column.getCellValue
const column = grid.columns.getById(columnId);
const cellValue3 = column.getCellValue(rowId);

// 三种方式结果相同
console.log(cellValue1 === cellValue2);  // true
console.log(cellValue2 === cellValue3);  // true
```

---

## 💾 CellValue（单元格值）结构

```javascript
const cellValue = grid.getCellValue(rowId, columnId);

// CellValue 对象包含:
{
  // 实际值（已格式化）
  value: "Hello World" | 123 | Date | Reference | ...,
  
  // 原始值（未格式化）
  rawValue: ...,
  
  // 显示文本
  display: "Hello World",
  
  // 如果是公式，可能有错误
  error: null | {
    message: "Division by zero",
    type: "FormulaError"
  },
  
  // 元数据
  metadata: {
    lastModified: Date,
    modifiedBy: "user-123",
    // ...
  }
}
```

---

## 🎨 实战案例

### 案例 1: 导出表格为 CSV

```javascript
function exportTableToCSV(tableId) {
  const grid = window.coda.documentModel.grids.tryGetById(tableId);
  if (!grid) return '';
  
  const columnIds = grid.columns.getIds();
  const rowIds = grid.rows.getIds();
  
  // CSV 头部（列名）
  const headers = columnIds.map(colId => {
    const col = grid.columns.getById(colId);
    return `"${col.name}"`;
  }).join(',');
  
  // CSV 数据行
  const rows = rowIds.map(rowId => {
    return columnIds.map(colId => {
      const cellValue = grid.getCellValue(rowId, colId);
      const value = cellValue?.display ?? '';
      return `"${value.replace(/"/g, '""')}"`;  // 转义双引号
    }).join(',');
  });
  
  return [headers, ...rows].join('\n');
}

// 使用
const csv = exportTableToCSV("table-GPDECroKmX");
console.log(csv);

// 下载 CSV
const blob = new Blob([csv], { type: 'text/csv' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'table.csv';
a.click();
```

### 案例 2: 统计表格数据

```javascript
function getTableStats(tableId) {
  const grid = window.coda.documentModel.grids.tryGetById(tableId);
  if (!grid) return null;
  
  const columnIds = grid.columns.getIds();
  const rowIds = grid.rows.getIds();
  
  const stats = {
    tableName: grid.name,
    totalRows: rowIds.length,
    totalColumns: columnIds.length,
    columns: {}
  };
  
  // 统计每列
  columnIds.forEach(colId => {
    const column = grid.columns.getById(colId);
    const values = [];
    let emptyCount = 0;
    
    rowIds.forEach(rowId => {
      const cellValue = grid.getCellValue(rowId, colId);
      const value = cellValue?.value;
      
      if (value === null || value === undefined || value === '') {
        emptyCount++;
      } else {
        values.push(value);
      }
    });
    
    stats.columns[column.name] = {
      type: column.type,
      emptyCount: emptyCount,
      filledCount: values.length,
      fillRate: `${((values.length / rowIds.length) * 100).toFixed(1)}%`
    };
    
    // 如果是数字列，计算统计值
    if (column.type === 'Number') {
      const numbers = values.filter(v => typeof v === 'number');
      if (numbers.length > 0) {
        stats.columns[column.name].sum = numbers.reduce((a, b) => a + b, 0);
        stats.columns[column.name].avg = stats.columns[column.name].sum / numbers.length;
        stats.columns[column.name].min = Math.min(...numbers);
        stats.columns[column.name].max = Math.max(...numbers);
      }
    }
  });
  
  return stats;
}

// 使用
const stats = getTableStats("table-GPDECroKmX");
console.log('Table Statistics:', stats);
```

### 案例 3: 查找包含特定值的行

```javascript
function findRowsByValue(tableId, columnName, searchValue) {
  const grid = window.coda.documentModel.grids.tryGetById(tableId);
  if (!grid) return [];
  
  // 找到目标列
  const columnIds = grid.columns.getIds();
  const targetColumn = columnIds.find(colId => {
    const col = grid.columns.getById(colId);
    return col.name === columnName;
  });
  
  if (!targetColumn) {
    console.log(`Column "${columnName}" not found`);
    return [];
  }
  
  // 搜索行
  const matchingRows = [];
  const rowIds = grid.rows.getIds();
  
  rowIds.forEach(rowId => {
    const cellValue = grid.getCellValue(rowId, targetColumn);
    const value = cellValue?.value;
    
    if (value && value.toString().includes(searchValue)) {
      matchingRows.push({
        rowId: rowId,
        rowData: {}
      });
      
      // 获取整行数据
      columnIds.forEach(colId => {
        const col = grid.columns.getById(colId);
        const cellVal = grid.getCellValue(rowId, colId);
        matchingRows[matchingRows.length - 1].rowData[col.name] = cellVal?.value;
      });
    }
  });
  
  return matchingRows;
}

// 使用
const results = findRowsByValue("table-GPDECroKmX", "Product Name", "iPhone");
console.log('Found rows:', results);
```

---

## 🔗 Slate 节点与 Grid 的关系

```
Slate Block Tree (内容结构)          Grid System (实际数据)
┌─────────────────────────┐        ┌─────────────────────────┐
│ {                       │        │ Grid {                  │
│   type: "Table",        │───────>│   id: "table-xxx",      │
│   id: "table-xxx",      │  引用  │   columns: [...],       │
│   style: "H2",          │        │   rows: [...],          │
│   children: [...]       │        │   getCellValue(...)     │
│ }                       │        │ }                       │
└─────────────────────────┘        └─────────────────────────┘
      (位置/样式)                        (数据/逻辑)
```

**关键点**：
- Slate 节点存储：位置、样式、对齐方式
- Grid 存储：实际的行、列、单元格数据
- 通过 `id` 字段关联

---

## 📝 总结

1. **Slate 中的 Table 节点**只是引用，不包含实际数据
2. **实际数据存储在 Grid 系统**中
3. **通过 `id` 访问**：`window.coda.documentModel.grids.tryGetById(tableId)`
4. **推荐使用 Resolver**：`resolver.typedGetters.tryGetGrid(tableId)`
5. **Grid 对象提供**：columns, rows, getCellValue 等 API

---

## 🛠️ 调试技巧

```javascript
// 1. 查看所有可用的 Grid
console.log('All grid IDs:', window.coda.documentModel.grids.getIds());

// 2. 检查 Grid 是否存在
const exists = window.coda.documentModel.grids.has(tableId);
console.log('Grid exists:', exists);

// 3. 查看 Grid 的完整结构
const grid = window.coda.documentModel.grids.tryGetById(tableId);
console.dir(grid);  // 使用 dir 查看所有属性和方法

// 4. 监听 Grid 变化
grid.on('changed', (event) => {
  console.log('Grid changed:', event);
});

// 5. 检查是否是 SyncTable
if (grid.isSyncTable) {
  console.log('This is a SyncTable from Pack:', grid.syncTable);
}
```

---

**文档创建时间**: 2025-10-16

**相关文档**:
- `02_data_layer_deep_dive.md` - 数据层详细分析
- `07_pack_architecture_deep_dive.md` - Pack SyncTable 机制
