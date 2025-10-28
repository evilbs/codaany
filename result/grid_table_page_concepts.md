# Coda 核心概念：Grid、Table、Page 详解

## 🎯 核心概念对比

| 概念 | 英文 | 中文 | 核心职责 | 类比 |
|------|------|------|---------|------|
| **Grid** | Grid | 网格/数据表 | **数据存储** | 数据库中的表（Schema + Data） |
| **Table** | Table | 视图/表格视图 | **数据展示** | 数据库中的视图（View） |
| **Page** | Page | 页面 | **内容组织** | 文档中的一页纸 |

---

## 📚 详细概念解析

### 1. Grid（网格/数据表）

**定义**：Grid 是 **实际存储数据的容器**，包含列定义、行数据和单元格值。

#### 从实际代码看 Grid

**文件位置**: `browser.6611b23ea80de0482abc.entry.js`

```javascript
/**
 * Grid - 数据存储的核心
 */
class Grid {
  // ===== 标识 =====
  id: string;              // 唯一标识，如 "table-GPDECroKmX"
  name: string;            // 用户定义的名称，如 "任务列表"
  
  // ===== 数据结构 =====
  columns: ColumnCollection;  // 列集合（列定义）
  rows: RowCollection;        // 行集合（行数据）
  cellStorage: CellStorage;   // 单元格存储（实际值）
  
  // ===== 视图管理 =====
  defaultView: Table;         // 默认视图
  views: ViewCollection;      // 所有视图
  
  // ===== 配置 =====
  config: {
    allowAddRows: boolean;
    allowDeleteRows: boolean;
    allowAddColumns: boolean;
    allowDeleteColumns: boolean;
    isSimpleTable: boolean;   // 是否为简单表格
  };
  
  // ===== 核心方法 =====
  getCellValue(rowId, columnId): CellValue;
  setCellValue(rowId, columnId, value): void;
  getDefaultView(): Table;
  
  // ===== 引用 =====
  document: DocumentModel;
  parent: Canvas | null;
}
```

#### Grid 的类型

**文件位置**: `browser.6611b23ea80de0482abc.entry.js`

```javascript
// DocumentModel 提供的 Grid 分类方法

// 1. Canvas Grid（用户创建的表格）
getCanvasGrids() {
  return this._resolver.findObjects({
    predicate: e => P.zn(e)  // 判断是否为 Canvas Grid
  });
}

// 2. Control Grid（控件使用的表格）
getControlGrids() {
  return this._resolver.findObjects({
    predicate: e => P.KL(e)  // 判断是否为 Control Grid
  });
}

// 3. Sync Table Grid（Pack 同步表）
getSyncTableGrids() {
  return this._resolver.findObjects({
    predicate: e => P.eD(e)  // 判断是否为 SyncTable
  });
}

// 4. DB-Backed Table Grid（数据库支持的表格）
getDbBackedTableGrids() {
  return this._resolver.findObjects({
    predicate: e => P.hh(e)  // 判断是否为 DB-Backed
  });
}
```

#### Grid 示例

```javascript
// 访问 Grid
const grid = window.coda.documentModel.session.resolver.typedGetters.tryGetGrid("table-GPDECroKmX");

console.log({
  id: grid.id,                      // "table-GPDECroKmX"
  name: grid.name,                  // "任务列表"
  type: grid.constructor.name,      // "Grid"
  
  // 数据统计
  columnCount: grid.columns.count,  // 5
  rowCount: grid.rows.count,        // 20
  
  // 类型判断
  isSimpleTable: grid.isSimpleTable,     // false
  isSyncTable: grid.isSyncTable,         // false
  isReferenceable: grid.isReferenceable, // true
  
  // 视图
  defaultViewId: grid.defaultView?.id,   // "view-default"
  viewCount: grid.views.count,           // 3
});
```

---

### 2. Table（视图/表格视图）

**定义**：Table 是 **Grid 的展示层**，定义如何显示数据（排序、筛选、分组、布局等）。

#### 从实际代码看 Table

**文件位置**: `browser.6611b23ea80de0482abc.entry.js`

```javascript
/**
 * Table - Grid 的视图
 * 一个 Grid 可以有多个 Table（不同的展示方式）
 */
class Table {
  // ===== 标识 =====
  id: string;                    // 视图 ID，如 "view-abc123"
  name: string;                  // 视图名称，如 "进行中的任务"
  
  // ===== 关联的 Grid =====
  sourceObjectId: string;        // 关联的 Grid ID
  grid: Grid;                    // Grid 引用（通过 sourceObjectId）
  
  // ===== 布局模式 =====
  layoutMode: LayoutMode;        // Card | List | Calendar | Gantt | Form | Detail
  
  // ===== 数据展示配置 =====
  sort: SortConfig[];            // 排序规则
  filter: FilterConfig;          // 筛选条件
  group: GroupConfig;            // 分组配置
  
  // ===== 列配置 =====
  visibleColumns: string[];      // 显示的列
  columnOrder: string[];         // 列顺序
  columnWidths: Map<string, number>;  // 列宽度
  
  // ===== 显示选项 =====
  showRowNumbers: boolean;       // 显示行号
  wrapCells: boolean;            // 单元格换行
  
  // ===== 核心方法 =====
  getGrid(): Grid;               // 获取关联的 Grid
  getVisibleRows(): Row[];       // 获取可见行（应用筛选/排序后）
  
  // ===== 引用 =====
  document: DocumentModel;
}
```

#### Table 的布局模式

```javascript
/**
 * 布局模式枚举
 */
enum LayoutMode {
  List = "List",           // 列表视图（默认）
  Card = "Card",           // 卡片视图
  Calendar = "Calendar",   // 日历视图
  Gantt = "Gantt",        // 甘特图视图
  Timeline = "Timeline",   // 时间线视图
  Board = "Board",        // 看板视图
  Form = "Form",          // 表单视图
  Detail = "Detail"       // 详情视图
}
```

#### Grid 和 Table 的关系

```
┌─────────────────────────────────────────────────┐
│ Grid: "任务列表"                                  │
│ ├── Columns: [任务名, 状态, 截止日期, 负责人]      │
│ └── Rows: 20 行数据                              │
└─────────────────────────────────────────────────┘
         │
         │ 一个 Grid 可以有多个 Table（视图）
         │
         ├─► Table 1 (默认视图)
         │   ├── Layout: List
         │   ├── Filter: 全部显示
         │   └── Sort: 按创建时间
         │
         ├─► Table 2 (进行中)
         │   ├── Layout: Card
         │   ├── Filter: 状态 = "进行中"
         │   └── Sort: 按优先级
         │
         └─► Table 3 (日历视图)
             ├── Layout: Calendar
             ├── Date Column: 截止日期
             └── Group By: 负责人
```

#### Table 示例

```javascript
// 获取 Grid 的默认视图
const grid = window.coda.documentModel.session.resolver.typedGetters.tryGetGrid("table-GPDECroKmX");
const defaultView = grid.getDefaultView();

console.log({
  id: defaultView.id,                    // "view-default"
  name: defaultView.name,                // "全部任务"
  sourceObjectId: defaultView.sourceObjectId,  // "table-GPDECroKmX"
  layoutMode: defaultView.layoutMode,    // "List"
  
  // 获取所有视图
  allViews: grid.views.getAllViews().map(v => ({
    id: v.id,
    name: v.name,
    layout: v.layoutMode
  }))
});

// 获取特定视图
const cardView = grid.views.getById("view-card");
console.log(cardView.layoutMode);  // "Card"
```

---

### 3. Page（页面）

**定义**：Page 是 **文档的组织单元**，包含一个 Canvas（画布），Canvas 中有 Slate（富文本编辑器）存储内容。

#### 从实际代码看 Page

**文件位置**: `browser.6611b23ea80de0482abc.entry.js`

```javascript
/**
 * Page - 文档的页面
 */
class Page {
  // ===== 标识 =====
  id: string;               // 页面 ID，如 "page-001"
  name: string;             // 页面名称，如 "项目概览"
  icon: string;             // 页面图标
  
  // ===== 内容 =====
  canvas: Canvas;           // 页面的画布
  
  // ===== 层级 =====
  parent: Page | null;      // 父页面（子页面支持）
  children: Page[];         // 子页面
  
  // ===== 元数据 =====
  createdAt: timestamp;
  updatedAt: timestamp;
  createdBy: string;
  
  // ===== 配置 =====
  isHidden: boolean;        // 是否隐藏
  isLocked: boolean;        // 是否锁定
  
  // ===== 引用 =====
  document: DocumentModel;
}

/**
 * Canvas - 页面的画布
 */
class Canvas {
  // ===== 标识 =====
  id: string;               // Canvas ID
  
  // ===== 内容编辑器 =====
  slate: Slate;             // 富文本编辑器（Slate.js）
  
  // ===== 核心方法 =====
  getCursor(): Cursor;      // 获取光标位置
  setCursor(cursor): void;  // 设置光标位置
  
  // ===== 引用 =====
  page: Page;
  document: DocumentModel;
}

/**
 * Slate - 富文本编辑器
 */
class Slate {
  // ===== 文档树 =====
  root: SlateRoot;          // 根节点
  
  // ===== 选区 =====
  selection: Range | null;  // 当前选区
  
  // ===== 编辑方法 =====
  inNormalizationBatch(fn): void;  // 批量编辑
}

/**
 * SlateRoot - Slate 根节点
 */
class SlateRoot {
  // ===== Block Tree =====
  children: Block[];        // 子节点（段落、标题、表格等）
  
  // ===== 选区 =====
  selection: Range | null;
}
```

#### Page 的层级结构

```
DocumentModel
└── PagesManager
    ├── Page 1: "项目概览"
    │   └── Canvas
    │       └── Slate
    │           └── Root
    │               ├── Paragraph (文本段落)
    │               ├── Heading (标题)
    │               ├── Table Node (引用 grid-1)  ← 这里引用 Grid
    │               └── InlineCollaborativeObject (按钮、公式)
    │
    ├── Page 2: "任务管理"
    │   ├── Canvas
    │   │   └── Slate
    │   │       └── Root
    │   │           ├── Paragraph
    │   │           └── Table Node (引用 grid-2)  ← 这里引用 Grid
    │   │
    │   └── Sub Page 2.1: "已完成任务"
    │       └── Canvas
    │
    └── Page 3: "数据分析"
        └── Canvas
```

#### Page 示例

```javascript
// 获取当前页面
const activePage = window.coda.documentModel.pagesManager.activePage;

console.log({
  id: activePage.id,            // "page-001"
  name: activePage.name,        // "项目概览"
  icon: activePage.icon,        // "📊"
  
  // Canvas
  canvasId: activePage.canvas.id,
  
  // Slate 内容
  slateRoot: activePage.canvas.slate.root,
  childrenCount: activePage.canvas.slate.root.children.length,
  
  // 子页面
  hasChildren: activePage.children?.length > 0,
  childrenNames: activePage.children?.map(p => p.name) || []
});

// 遍历页面的所有内容块
activePage.canvas.slate.root.children.forEach((block, index) => {
  console.log(`Block ${index}:`, {
    type: block.type,
    id: block.id,
    // 如果是表格节点，显示引用的 Grid ID
    gridId: block.type === 'Table' ? block.id : null
  });
});
```

---

## 🔗 三者之间的关系

### 完整的关系图

```
┌──────────────────────────────────────────────────────────────┐
│ DocumentModel                                                 │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  PagesManager                     Session                    │
│  ├── Page 1: "概览"                └── Resolver              │
│  │   └── Canvas                        └── Grids (全局)     │
│  │       └── Slate                         ├── Grid 1       │
│  │           └── Root                      ├── Grid 2       │
│  │               ├── Paragraph             └── Grid 3       │
│  │               ├── Table (引用 Grid 1) ──────┘            │
│  │               └── Table (引用 Grid 2) ──────┘            │
│  │                                                           │
│  ├── Page 2: "任务"                                          │
│  │   └── Canvas                                             │
│  │       └── Slate                                          │
│  │           └── Root                                       │
│  │               ├── Heading                                │
│  │               └── Table (引用 Grid 3) ──────┘            │
│  │                                                           │
│  └── Page 3: "分析"                                          │
│      └── Canvas                                             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 关键点

1. **Page 通过 Slate 引用 Grid**
   - Page 不直接拥有 Grid
   - Slate 的 Table 节点存储 Grid ID
   - 实际数据在全局的 Grid 对象中

2. **Grid 可以被多个 Page 引用**
   - 同一个 Grid 可以在不同页面显示
   - 每个页面可以有不同的 Table 视图

3. **Table 是 Grid 的视图**
   - 一个 Grid 可以有多个 Table
   - Table 只存储展示配置，不存储数据

---

## 📊 实际使用场景

### 场景 1: 在多个页面显示同一个表格

```javascript
// Grid 在全局只有一份
const taskGrid = window.coda.documentModel.session.resolver.typedGetters.tryGetGrid("grid-tasks");

// Page 1: 概览页 - 显示所有任务（列表视图）
// Slate 中有一个 Table 节点引用 "grid-tasks"，使用默认视图

// Page 2: 看板页 - 显示任务（卡片视图）
// Slate 中有一个 Table 节点引用 "grid-tasks"，使用卡片视图

// Page 3: 日历页 - 显示任务（日历视图）
// Slate 中有一个 Table 节点引用 "grid-tasks"，使用日历视图

// 修改任何一个页面的数据，其他页面都会同步更新（因为都引用同一个 Grid）
```

### 场景 2: 创建表格的完整流程

```javascript
/**
 * 创建表格的完整流程
 */
async function createTableInPage(pageName, gridName) {
  const dm = window.coda.documentModel;
  
  // Step 1: 创建 Grid（数据容器）
  const gridId = `table-${generateId()}`;
  const grid = new Grid({
    id: gridId,
    name: gridName,
    columns: [
      { id: 'c-1', name: '任务名', type: 'Text' },
      { id: 'c-2', name: '状态', type: 'SelectList' }
    ]
  });
  
  // 注册到全局
  dm.session.resolver.objectIndex.register(grid);
  
  // Step 2: 创建默认 Table（视图）
  const defaultView = new Table({
    id: `${gridId}$default`,
    sourceObjectId: gridId,
    layoutMode: 'List',
    name: gridName
  });
  
  grid.views.add(defaultView);
  
  // Step 3: 在 Page 的 Slate 中插入 Table 节点（引用）
  const page = dm.pagesManager.getByName(pageName);
  const slateNode = {
    id: gridId,  // 引用 Grid ID
    type: 'Table',
    children: [{ text: '' }]
  };
  
  // 插入到 Slate
  page.canvas.slate.inNormalizationBatch(() => {
    Transforms.insertNodes(page.canvas.slate, slateNode);
  });
  
  console.log('创建完成:');
  console.log('  Grid ID:', gridId);
  console.log('  Default View ID:', defaultView.id);
  console.log('  Page:', pageName);
}
```

### 场景 3: 查找某个 Grid 被哪些 Page 使用

```javascript
/**
 * 查找 Grid 的所有引用位置
 */
function findGridReferences(gridId) {
  const dm = window.coda.documentModel;
  const pages = dm.pagesManager.getFlattenedPages();
  const references = [];
  
  pages.forEach(page => {
    const canvas = page.canvas;
    if (!canvas || !canvas.slate) return;
    
    // 遍历 Slate 查找 Table 节点
    function traverse(node, path = []) {
      if (node.type === 'Table' && node.id === gridId) {
        references.push({
          pageId: page.id,
          pageName: page.name,
          path: path,
          node: node
        });
      }
      
      if (node.children) {
        node.children.forEach((child, index) => {
          traverse(child, [...path, index]);
        });
      }
    }
    
    traverse(canvas.slate.root);
  });
  
  console.log(`Grid "${gridId}" 被以下页面引用:`);
  references.forEach(ref => {
    console.log(`  - ${ref.pageName} (path: ${ref.path.join(' > ')})`);
  });
  
  return references;
}

// 使用
const grid = window.coda.documentModel.getCanvasGrids()[0];
findGridReferences(grid.id);
```

---

## 🛠️ 常用操作

### 1. 从 Page 访问 Grid

```javascript
// 方式 1: 遍历 Slate 找到 Table 节点
const page = window.coda.documentModel.pagesManager.activePage;
const tableNodes = [];

function findTables(node) {
  if (node.type === 'Table') {
    tableNodes.push(node);
  }
  if (node.children) {
    node.children.forEach(child => findTables(child));
  }
}

findTables(page.canvas.slate.root);

// 访问每个 Grid
const grids = tableNodes.map(node => {
  return window.coda.documentModel.session.resolver.typedGetters.tryGetGrid(node.id);
});

console.log('当前页面的 Grids:', grids);
```

### 2. 从 Grid 访问所有 Table 视图

```javascript
const grid = window.coda.documentModel.session.resolver.typedGetters.tryGetGrid("table-GPDECroKmX");

// 获取默认视图
const defaultView = grid.getDefaultView();
console.log('默认视图:', defaultView.name);

// 获取所有视图
const allViews = grid.views.getAllViews();
console.log('所有视图:');
allViews.forEach(view => {
  console.log(`  - ${view.name} (${view.layoutMode})`);
});

// 获取特定视图
const viewId = `${grid.id}$view-card`;
const cardView = grid.views.tryGetById(viewId);
if (cardView) {
  console.log('卡片视图:', cardView);
}
```

### 3. 获取所有 Pages

```javascript
const dm = window.coda.documentModel;

// 获取顶层页面
const topLevelPages = dm.pagesManager.getTopLevelPages();
console.log('顶层页面:', topLevelPages.map(p => p.name));

// 获取扁平化的所有页面（包括子页面）
const allPages = dm.pagesManager.getFlattenedPages();
console.log('所有页面:', allPages.map(p => ({
  name: p.name,
  parent: p.parent?.name || 'Root'
})));

// 获取活动页面
const activePage = dm.pagesManager.activePage;
console.log('当前页面:', activePage.name);
```

---

## 📋 总结对比表

| 特性 | Grid | Table | Page |
|------|------|-------|------|
| **本质** | 数据容器 | 数据视图 | 内容组织 |
| **存储位置** | 全局（DocumentModel.grids） | Grid.views | DocumentModel.pagesManager |
| **数量关系** | 1个 Grid | 可以有多个 Table | 1个 Page |
| **包含内容** | Columns, Rows, CellStorage | Sort, Filter, Layout | Canvas, Slate, Blocks |
| **引用方式** | 被 Slate Table 节点引用 | 引用 Grid（sourceObjectId） | 包含 Canvas |
| **可复用性** | 可被多个 Page 引用 | 属于特定 Grid | 独立存在 |
| **UI 表现** | 不直接显示 | 用户看到的表格 | 文档的一个标签页 |

---

## 🎯 关键要点

### 1. 数据流向

```
用户在 Page 上看到表格
    ↓
Page.Canvas.Slate 中的 Table 节点（引用）
    ↓
引用全局的 Grid（数据存储）
    ↓
Grid.getDefaultView() 或其他 Table（视图配置）
    ↓
渲染引擎根据 Table 的配置展示 Grid 的数据
```

### 2. 为什么这样设计？

**Grid 和 Table 分离**：
- ✅ 一个 Grid 可以有多个视图（列表、卡片、日历等）
- ✅ 数据和展示解耦，修改视图不影响数据
- ✅ 同一个 Grid 可以在不同页面以不同方式展示

**Page 通过引用访问 Grid**：
- ✅ Grid 可以被多个 Page 共享
- ✅ 减少数据冗余
- ✅ 修改一处，所有引用位置同步更新

### 3. 常见误区

❌ **误区 1**: Page 直接拥有 Grid
```javascript
// 错误理解
page.grids  // Page 没有 grids 属性
```

✅ **正确**: Page 通过 Slate 引用 Grid
```javascript
// 正确理解
page.canvas.slate.root.children  // 包含 Table 节点（引用）
```

❌ **误区 2**: Grid 和 Table 是同一个东西
```javascript
// 它们不同！
Grid    // 数据存储
Table   // 数据视图
```

❌ **误区 3**: Canvas 上有 getCanvasGrids() 方法
```javascript
// 错误
canvas.getCanvasGrids()  // Canvas 没有这个方法

// 正确
documentModel.getCanvasGrids()  // 在 DocumentModel 上
```

---

## 🔍 调试技巧

### 查看三者的关系

```javascript
/**
 * 完整展示 Page -> Grid -> Table 的关系
 */
function analyzePageGridRelationship() {
  const dm = window.coda.documentModel;
  const activePage = dm.pagesManager.activePage;
  
  console.log('=== Page 信息 ===');
  console.log('Page ID:', activePage.id);
  console.log('Page Name:', activePage.name);
  console.log('Canvas ID:', activePage.canvas.id);
  
  console.log('\n=== Slate 中的 Table 节点 ===');
  const tableNodes = [];
  
  function findTables(node, depth = 0) {
    const indent = '  '.repeat(depth);
    
    if (node.type === 'Table') {
      console.log(`${indent}✓ Table 节点: ${node.id}`);
      tableNodes.push(node);
    }
    
    if (node.children) {
      node.children.forEach(child => findTables(child, depth + 1));
    }
  }
  
  findTables(activePage.canvas.slate.root);
  
  console.log(`\n找到 ${tableNodes.length} 个 Table 节点\n`);
  
  console.log('=== 对应的 Grid 和 Table 视图 ===');
  tableNodes.forEach((node, index) => {
    const grid = dm.session.resolver.typedGetters.tryGetGrid(node.id);
    
    if (!grid) {
      console.log(`${index + 1}. ❌ Grid 未找到 (ID: ${node.id})`);
      return;
    }
    
    console.log(`${index + 1}. Grid: ${grid.name} (${grid.id})`);
    console.log(`   - Rows: ${grid.rows.count}`);
    console.log(`   - Columns: ${grid.columns.count}`);
    
    const views = grid.views.getAllViews();
    console.log(`   - Views (${views.length}):`);
    
    views.forEach(view => {
      console.log(`     • ${view.name} (${view.layoutMode})`);
    });
  });
}

// 运行
analyzePageGridRelationship();
```

---

**文档创建时间**: 2025-10-16

**相关文档**:
- `slate_to_grid_access_guide.md` - Grid 访问指南
- `table_data_access_guide.md` - 表格数据访问
- `getCanvasGrids_error_fix.md` - getCanvasGrids 错误修复
