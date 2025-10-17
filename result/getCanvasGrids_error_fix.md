# getCanvasGrids() 方法调用错误修复指南

## ❌ 错误调用

```javascript
// 这个会报错！
window.coda.documentModel.pagesManager.activePage.canvas.getCanvasGrids()
```

**错误信息**：
```
TypeError: canvas.getCanvasGrids is not a function
```

---

## 🎯 问题根源

### 从实际代码中发现的真相

**文件位置**: `browser.6611b23ea80de0482abc.entry.js`

```javascript
// getCanvasGrids() 是 DocumentModel 的方法，不是 Canvas 的方法！
class DocumentModel {
  // ...
  
  getCanvasGrids() {
    return this._cachedCanvasGrids || (
      this._cachedCanvasGrids = this._resolver.findObjects({
        predicate: e => P.zn(e)  // P.zn 是判断是否为 Canvas Grid 的函数
      })
    ), this._cachedCanvasGrids;
  }
  
  getCanvasGrids() {
    return this.session.resolver.typedGetters.getCanvasGrids();
  }
  
  // ... 其他方法
}
```

**关键发现**：
- `getCanvasGrids()` 方法定义在 **`DocumentModel`** 上
- 它通过 `resolver.findObjects()` 查找**整个文档**中所有的 Canvas Grid
- **Canvas 对象本身并没有这个方法**

---

## ✅ 正确的调用方式

### 方法 1: 通过 DocumentModel（推荐）

```javascript
// ✅ 正确：直接从 DocumentModel 调用
const allCanvasGrids = window.coda.documentModel.getCanvasGrids();

console.log('所有表格:', allCanvasGrids.map(g => ({
  id: g.id,
  name: g.name,
  rowCount: g.rows.count,
  columnCount: g.columns.count
})));
```

### 方法 2: 通过 Resolver（等价）

```javascript
// ✅ 也正确：通过 resolver.typedGetters
const resolver = window.coda.documentModel.session.resolver;
const allCanvasGrids = resolver.typedGetters.getCanvasGrids();

console.log('找到', allCanvasGrids.length, '个表格');
```

### 方法 3: 获取当前页面的 Grids（如果只需要当前页面）

```javascript
// ✅ 如果只需要当前页面的表格
const activePage = window.coda.documentModel.pagesManager.activePage;
const canvas = activePage.canvas;

// 获取所有表格
const allGrids = window.coda.documentModel.getCanvasGrids();

// 过滤出当前 Canvas 中的表格
const currentCanvasGrids = allGrids.filter(grid => {
  // 检查 Grid 是否属于当前 Canvas
  const gridContext = grid.getObjectContext?.();
  return gridContext?.parentId === canvas.id;
});

console.log('当前页面的表格:', currentCanvasGrids.map(g => g.name));
```

---

## 🔍 为什么 getCanvasGrids() 在 DocumentModel 上？

### 架构设计原因

```
DocumentModel (文档级别)
├── PagesManager
│   ├── Page 1
│   │   └── Canvas 1
│   │       └── Slate (Block Tree)
│   │           ├── Table Node (引用 grid-1)
│   │           └── Table Node (引用 grid-2)
│   ├── Page 2
│   │   └── Canvas 2
│   │       └── Slate (Block Tree)
│   │           └── Table Node (引用 grid-3)
│   
└── Grids (全局存储)
    ├── grid-1 (实际数据)
    ├── grid-2 (实际数据)
    └── grid-3 (实际数据)
```

**关键点**：
1. **Grid 数据是全局存储的**，不属于某个特定的 Canvas
2. **Canvas 中的 Slate 只存储引用**（Table 节点包含 gridId）
3. **`getCanvasGrids()` 需要遍历所有 Grid**，判断哪些是"Canvas Grid"（用户创建的表格）

### 实际代码中的实现

**文件位置**: `browser.6611b23ea80de0482abc.entry.js`

```javascript
// TypedGetters 的实现
class TypedGetters {
  constructor(resolver) {
    this._resolver = resolver;
    this._cachedCanvasGrids = null;
  }
  
  /**
   * 获取所有 Canvas Grids（用户在页面上创建的表格）
   */
  getCanvasGrids() {
    // 使用缓存
    if (!this._cachedCanvasGrids) {
      // 从 resolver 查找所有符合条件的对象
      this._cachedCanvasGrids = this._resolver.findObjects({
        predicate: e => P.zn(e)  // P.zn(e) 判断是否为 Canvas Grid
      });
    }
    
    return this._cachedCanvasGrids;
  }
  
  /**
   * 获取所有 Control Grids（按钮、公式等内部表格）
   */
  getControlGrids() {
    if (!this._cachedControlGrids) {
      this._cachedControlGrids = this._resolver.findObjects({
        predicate: e => P.KL(e)  // P.KL(e) 判断是否为 Control Grid
      });
    }
    
    return this._cachedControlGrids;
  }
}
```

---

## 📋 各种 Grid 类型对比

| 类型 | 获取方法 | 说明 | 示例 |
|------|---------|------|------|
| **Canvas Grid** | `getCanvasGrids()` | 用户在页面上创建的表格 | 任务列表、客户表 |
| **Control Grid** | `getControlGrids()` | 控件内部使用的表格 | 按钮、自动化、公式 |
| **Sync Table Grid** | `getSyncTableGrids()` | Pack 同步表 | Gmail、Jira 数据 |
| **DB-Backed Table** | `getDbBackedTableGrids()` | 数据库支持的表格 | 企业版功能 |

### 实际代码示例

**文件位置**: `browser.6611b23ea80de0482abc.entry.js`

```javascript
// DocumentModel 提供的所有 Grid 获取方法
class DocumentModel {
  /**
   * 获取 Canvas Grids（页面表格）
   */
  getCanvasGrids() {
    return this._cachedCanvasGrids || (
      this._cachedCanvasGrids = this._resolver.findObjects({
        predicate: e => P.zn(e)
      })
    );
  }
  
  /**
   * 获取 Control Grids（控件表格）
   */
  getControlGrids() {
    return this._cachedControlGrids || (
      this._cachedControlGrids = this._resolver.findObjects({
        predicate: e => P.KL(e)
      })
    );
  }
  
  /**
   * 获取 Core Grids（核心表格，Canvas Grid 的子集）
   */
  getCoreGrids() {
    return this._cachedCoreGrids || (
      this._cachedCoreGrids = [...this.getCanvasGrids()].filter(e => e.isCoreGrid)
    );
  }
  
  /**
   * 获取 DB-Backed Table Grids
   */
  getDbBackedTableGrids() {
    return this._cachedDbBackedTableGrids || (
      this._cachedDbBackedTableGrids = this._resolver.findObjects({
        predicate: e => P.hh(e)
      })
    );
  }
  
  /**
   * 获取可链接的 Grids
   */
  getLinkableGrids() {
    return this._cachedLinkableGrids || (
      this._cachedLinkableGrids = [
        ...this.getCanvasGrids(),
        ...this.getControlGrids()
      ].filter(e => e.allowLinkedTableCreation)
    );
  }
  
  /**
   * 获取可搜索的 Grids
   */
  getSearchableGrids() {
    return this._cachedSearchableGrids || (
      this._cachedSearchableGrids = [
        ...this.getCanvasGrids()
      ].filter(e => e.allowSearch)
    );
  }
  
  /**
   * 获取可引用的 Canvas Grids
   */
  getReferencableCanvasGrids() {
    return this._cachedReferencableCanvasGrids || (
      this._cachedReferencableCanvasGrids = [
        ...this.getCanvasGrids()
      ].filter(e => e.isReferenceable)
    );
  }
  
  /**
   * 获取 Sync Table Grids
   */
  getSyncTableGrids({ includeDeleted = false } = {}) {
    return this._cachedSyncTableGrids || (
      this._cachedSyncTableGrids = this._resolver.findObjects({
        predicate: e => P.eD(e),
        includeDeleted
      })
    );
  }
}
```

---

## 🛠️ 实用工具函数

### 1. 获取当前页面的所有表格

```javascript
/**
 * 获取当前活动页面中的所有表格
 */
function getCurrentPageGrids() {
  const documentModel = window.coda.documentModel;
  const activePage = documentModel.pagesManager.activePage;
  
  if (!activePage) {
    console.log('没有活动页面');
    return [];
  }
  
  // 获取所有 Canvas Grids
  const allGrids = documentModel.getCanvasGrids();
  
  // 过滤出当前页面的
  const currentPageGrids = [];
  
  // 遍历 Slate 找到所有 Table 节点
  function findTableNodes(node, grids = []) {
    if (node.type === 'Table' && node.id) {
      const grid = allGrids.find(g => g.id === node.id);
      if (grid) {
        grids.push(grid);
      }
    }
    
    if (node.children) {
      node.children.forEach(child => findTableNodes(child, grids));
    }
    
    return grids;
  }
  
  const pageGrids = findTableNodes(activePage.canvas.slate.root);
  
  console.log(`当前页面 "${activePage.name}" 有 ${pageGrids.length} 个表格:`);
  pageGrids.forEach(grid => {
    console.log(`  - ${grid.name} (${grid.rows.count} 行, ${grid.columns.count} 列)`);
  });
  
  return pageGrids;
}

// 使用
const currentGrids = getCurrentPageGrids();
```

### 2. 对比所有类型的 Grids

```javascript
/**
 * 统计文档中所有类型的 Grids
 */
function analyzeAllGrids() {
  const dm = window.coda.documentModel;
  
  const stats = {
    canvasGrids: dm.getCanvasGrids(),
    controlGrids: dm.getControlGrids(),
    coreGrids: dm.getCoreGrids?.() || [],
    syncTableGrids: dm.getSyncTableGrids?.() || [],
    linkableGrids: dm.getLinkableGrids?.() || [],
    searchableGrids: dm.getSearchableGrids?.() || []
  };
  
  console.log('=== Grid Statistics ===');
  console.log(`Canvas Grids (用户表格): ${stats.canvasGrids.length}`);
  console.log(`Control Grids (控件表格): ${stats.controlGrids.length}`);
  console.log(`Core Grids (核心表格): ${stats.coreGrids.length}`);
  console.log(`Sync Table Grids (Pack表): ${stats.syncTableGrids.length}`);
  console.log(`Linkable Grids (可链接): ${stats.linkableGrids.length}`);
  console.log(`Searchable Grids (可搜索): ${stats.searchableGrids.length}`);
  
  // 详细列表
  console.log('\n=== Canvas Grids 详情 ===');
  stats.canvasGrids.forEach((grid, index) => {
    console.log(`${index + 1}. ${grid.name || grid.id}`);
    console.log(`   ID: ${grid.id}`);
    console.log(`   Rows: ${grid.rows.count}, Columns: ${grid.columns.count}`);
    console.log(`   Is Core Grid: ${grid.isCoreGrid}`);
    console.log(`   Is Referenceable: ${grid.isReferenceable}`);
  });
  
  return stats;
}

// 使用
const gridStats = analyzeAllGrids();
```

### 3. 查找 Grid 所在的页面

```javascript
/**
 * 查找指定 Grid 所在的页面
 */
function findPageForGrid(gridId) {
  const dm = window.coda.documentModel;
  const pages = dm.pagesManager.getFlattenedPages();
  
  for (const page of pages) {
    const canvas = page.canvas;
    
    if (!canvas || !canvas.slate) {
      continue;
    }
    
    // 在 Slate 树中查找
    let found = false;
    
    function search(node) {
      if (found) return;
      
      if (node.type === 'Table' && node.id === gridId) {
        found = true;
        return;
      }
      
      if (node.children) {
        node.children.forEach(child => search(child));
      }
    }
    
    search(canvas.slate.root);
    
    if (found) {
      console.log(`✅ Grid "${gridId}" 在页面: ${page.name} (${page.id})`);
      return page;
    }
  }
  
  console.log(`❌ Grid "${gridId}" 未在任何页面中找到`);
  return null;
}

// 使用
const grid = window.coda.documentModel.getCanvasGrids()[0];
if (grid) {
  findPageForGrid(grid.id);
}
```

---

## ⚠️ 常见错误总结

### 错误 1: 在 Canvas 上调用 `getCanvasGrids()`

```javascript
// ❌ 错误
const grids = window.coda.documentModel.pagesManager.activePage.canvas.getCanvasGrids();
// TypeError: canvas.getCanvasGrids is not a function

// ✅ 正确
const grids = window.coda.documentModel.getCanvasGrids();
```

### 错误 2: 混淆 Canvas Grid 和 Control Grid

```javascript
// ❌ 可能不完整
const grids = window.coda.documentModel.getCanvasGrids();
// 只包含用户创建的表格，不包含按钮、自动化等内部表格

// ✅ 如果需要所有 Grid
const allGrids = [
  ...window.coda.documentModel.getCanvasGrids(),
  ...window.coda.documentModel.getControlGrids()
];
```

### 错误 3: 没有考虑缓存失效

```javascript
// ⚠️ 缓存可能过时
const grids1 = window.coda.documentModel.getCanvasGrids();
console.log('表格数:', grids1.length);  // 例如: 5

// ... 用户创建了新表格 ...

const grids2 = window.coda.documentModel.getCanvasGrids();
console.log('表格数:', grids2.length);  // 可能仍然是 5（缓存未更新）

// ✅ 需要等待文档更新事件
window.coda.documentModel.on('GridAdded', () => {
  // 缓存会自动清除
  const updatedGrids = window.coda.documentModel.getCanvasGrids();
  console.log('更新后:', updatedGrids.length);
});
```

---

## 📚 相关 API 总结

| API | 位置 | 返回值 | 说明 |
|-----|------|--------|------|
| `getCanvasGrids()` | `DocumentModel` | `Grid[]` | 所有用户表格 |
| `getControlGrids()` | `DocumentModel` | `Grid[]` | 所有控件表格 |
| `getCoreGrids()` | `DocumentModel` | `Grid[]` | 核心表格 |
| `getSyncTableGrids()` | `DocumentModel` | `Grid[]` | Pack 同步表 |
| `getLinkableGrids()` | `DocumentModel` | `Grid[]` | 可创建链接的表格 |
| `getSearchableGrids()` | `DocumentModel` | `Grid[]` | 可搜索的表格 |
| `tryGetGrid(id)` | `Resolver.typedGetters` | `Grid \| undefined` | 按 ID 获取单个 Grid |

---

## 🎯 最佳实践

### ✅ 推荐

```javascript
// 1. 从正确的位置调用
const grids = window.coda.documentModel.getCanvasGrids();

// 2. 使用可选链防止错误
const grids = window.coda?.documentModel?.getCanvasGrids?.() || [];

// 3. 根据需求选择合适的方法
const userTables = window.coda.documentModel.getCanvasGrids();
const controls = window.coda.documentModel.getControlGrids();

// 4. 处理当前页面的表格
const currentPageGrids = getCurrentPageGrids();  // 使用上面的工具函数
```

### ❌ 避免

```javascript
// 1. 不要在 Canvas 上调用
// ❌ canvas.getCanvasGrids()

// 2. 不要假设缓存总是最新的
// ❌ 在创建新表格后立即读取可能拿到旧数据

// 3. 不要忽略不同类型的 Grid
// ❌ 只考虑 Canvas Grid 可能遗漏重要数据
```

---

## 🔍 调试技巧

### 1. 检查方法是否存在

```javascript
const canvas = window.coda.documentModel.pagesManager.activePage.canvas;

console.log('Canvas methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(canvas))
  .filter(name => typeof canvas[name] === 'function')
);

// 你会发现列表中没有 getCanvasGrids
```

### 2. 验证正确的调用路径

```javascript
console.log('DocumentModel methods:');
const dm = window.coda.documentModel;
Object.getOwnPropertyNames(Object.getPrototypeOf(dm))
  .filter(name => name.includes('Grid'))
  .forEach(name => console.log(`  - ${name}`));

// 输出：
//   - getCanvasGrids
//   - getControlGrids
//   - getCoreGrids
//   - ...
```

---

## 📝 总结

### 核心要点

1. ✅ **`getCanvasGrids()` 是 DocumentModel 的方法**
2. ❌ **Canvas 对象没有这个方法**
3. 🎯 **正确调用**: `window.coda.documentModel.getCanvasGrids()`
4. 🔍 **原因**: Grid 数据是全局存储的，不属于特定 Canvas

### 快速修复

```javascript
// 将这个：
window.coda.documentModel.pagesManager.activePage.canvas.getCanvasGrids()

// 改成这个：
window.coda.documentModel.getCanvasGrids()
```

---

**文档创建时间**: 2025-10-16

**相关文档**:
- `slate_to_grid_access_guide.md` - Grid 访问指南
- `table_data_access_guide.md` - 表格数据访问
- `objectsMap_access_guide.md` - 对象映射访问
