# Coda _objectsMap 访问指南

## 🔍 什么是 _objectsMap？

`_objectsMap` 是 **Resolver 内部的私有 Map**，用于存储文档中所有对象的索引。

### 从实际代码中的定义

**文件位置**: `browser.6611b23ea80de0482abc.entry.js`

```javascript
// Resolver 的内部实现
class Resolver {
  constructor() {
    // 私有属性（以 _ 开头）
    this._objectsMap = new Map();  // 存储所有对象
    this._isDeleted = new Map();   // 标记删除状态
    this._nearestDeletedAncestor = new Map();  // 删除的祖先
    this._childrenMap = new Map();  // 子对象映射
    this._objectContextCache = null;  // 对象上下文缓存
  }
  
  // 内部方法：注册对象
  _register(object) {
    const id = this._getId(object);
    const listener = this._createListener(object);
    
    // 存储对象和监听器
    this._objectsMap.set(id, {
      object: object,
      listener: listener
    });
  }
  
  // 内部方法：获取对象ID
  _getId(object) {
    return object.type === 'Document' 
      ? 'DOCUMENT_ROOT' 
      : object.id;
  }
  
  // 公开方法：通过ID获取对象
  getById(id, { includeDeleted = false } = {}) {
    const entry = this._objectsMap.get(id);
    
    if (!entry) {
      return null;
    }
    
    // 检查是否已删除
    if (!includeDeleted && this.isDeleted(entry.object)) {
      return null;
    }
    
    return entry.object;
  }
}
```

### _objectsMap 的数据结构

```javascript
// _objectsMap 是一个 Map，结构如下：
Map<objectId, ObjectEntry>

// ObjectEntry 结构：
{
  object: Object,      // 实际的对象（Grid、Column、Row等）
  listener: Listener   // 对象的事件监听器
}

// 示例数据：
{
  "table-GPDECroKmX": {
    object: Grid { id: "table-GPDECroKmX", name: "My Table", ... },
    listener: Listener { ... }
  },
  "c-abc123": {
    object: Column { id: "c-abc123", name: "Name", type: "Text", ... },
    listener: Listener { ... }
  },
  "r-xyz789": {
    object: Row { id: "r-xyz789", values: {...}, ... },
    listener: Listener { ... }
  }
}
```

---

## ⚠️ 为什么不应该直接访问 _objectsMap？

### 1. 它是私有属性

```javascript
// ❌ 不推荐：直接访问私有属性
const objectsMap = window.coda.documentModel.session.resolver._objectsMap;

// 问题：
// 1. 属性名以 _ 开头，表示这是私有的
// 2. 可能在未来版本中改变或移除
// 3. 直接访问绕过了封装和权限检查
```

### 2. 缺少必要的检查

```javascript
// 直接从 _objectsMap 获取可能包含已删除的对象
const entry = resolver._objectsMap.get(objectId);
const obj = entry?.object;  // 可能是已删除的对象！

// 而通过公开API会自动过滤：
const obj = resolver.typedGetters.tryGetGrid(objectId);  // 已删除则返回 undefined
```

### 3. 没有类型检查

```javascript
// 直接访问无类型检查
const entry = resolver._objectsMap.get(objectId);
// entry.object 可能是任何类型：Grid、Column、Row、Page等

// 通过 typedGetters 有类型保证
const grid = resolver.typedGetters.tryGetGrid(objectId);  // 确保返回 Grid 或 undefined
```

---

## ✅ 正确的访问方式

### 方法 1: 使用 TypedGetters（推荐）

```javascript
const resolver = window.coda.documentModel.session.resolver;

// 获取 Grid
const grid = resolver.typedGetters.tryGetGrid("table-GPDECroKmX");

// 获取 Column
const column = resolver.typedGetters.tryGetColumn("table-GPDECroKmX", "c-abc123");

// 获取 Row
const row = resolver.typedGetters.tryGetRow("table-GPDECroKmX", "r-xyz789");

// 获取 Page
const page = resolver.typedGetters.tryGetPage("page-123");

// 获取 Canvas
const canvas = resolver.typedGetters.tryGetPageCanvas("canvas-123");
```

### 方法 2: 使用 Resolver.getById（通用方法）

```javascript
const resolver = window.coda.documentModel.session.resolver;

// 获取任意对象（无类型检查）
const object = resolver.getById(objectId);

// 带选项
const object = resolver.getById(objectId, { 
  includeDeleted: true  // 包含已删除的对象
});
```

### 方法 3: 遍历所有对象

```javascript
const resolver = window.coda.documentModel.session.resolver;

// 获取所有对象（通过公开方法）
const allObjects = resolver.getAllObjects({
  includeDeleted: false  // 排除已删除的对象
});

console.log(`Total objects: ${allObjects.length}`);

allObjects.forEach(obj => {
  console.log(`- ${obj.id} (${obj.type})`);
});
```

---

## 🔧 实际使用示例

### 示例 1: 调试 - 查看所有对象（安全方式）

```javascript
/**
 * 安全地遍历文档中的所有对象
 */
function listAllDocumentObjects() {
  const resolver = window.coda.documentModel.session.resolver;
  
  // 通过公开API获取所有对象
  const objects = resolver.getAllObjects();
  
  // 按类型分组
  const byType = {};
  
  objects.forEach(obj => {
    const typeName = obj.constructor.name || obj.type || 'Unknown';
    
    if (!byType[typeName]) {
      byType[typeName] = [];
    }
    
    byType[typeName].push({
      id: obj.id,
      name: obj.name || obj.id,
      isDeleted: resolver.isDeleted(obj)
    });
  });
  
  // 打印统计
  console.log('=== Document Objects by Type ===');
  
  Object.keys(byType).sort().forEach(typeName => {
    const items = byType[typeName];
    console.log(`\n${typeName} (${items.length}):`);
    
    items.slice(0, 5).forEach(item => {
      console.log(`  - ${item.name} (${item.id})${item.isDeleted ? ' [DELETED]' : ''}`);
    });
    
    if (items.length > 5) {
      console.log(`  ... and ${items.length - 5} more`);
    }
  });
  
  return byType;
}

// 使用
const objectsByType = listAllDocumentObjects();
```

### 示例 2: 查找特定类型的所有对象

```javascript
/**
 * 获取所有特定类型的对象
 */
function getObjectsByType(typeName) {
  const resolver = window.coda.documentModel.session.resolver;
  const allObjects = resolver.getAllObjects();
  
  return allObjects.filter(obj => {
    const objType = obj.constructor.name || obj.type;
    return objType === typeName;
  });
}

// 使用示例
const allGrids = getObjectsByType('Grid');
console.log(`Found ${allGrids.length} grids:`);
allGrids.forEach(grid => {
  console.log(`  - ${grid.name} (${grid.id})`);
});

const allColumns = getObjectsByType('Column');
console.log(`\nFound ${allColumns.length} columns`);
```

### 示例 3: 搜索对象（按名称）

```javascript
/**
 * 按名称搜索对象
 */
function searchObjectsByName(searchTerm) {
  const resolver = window.coda.documentModel.session.resolver;
  const allObjects = resolver.getAllObjects();
  
  const results = allObjects.filter(obj => {
    const name = obj.name || obj.id;
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });
  
  console.log(`Found ${results.length} objects matching "${searchTerm}":`);
  
  results.forEach(obj => {
    console.log(`  - ${obj.name || obj.id} (${obj.constructor.name})`);
  });
  
  return results;
}

// 使用
const results = searchObjectsByName("Task");
```

---

## 🛠️ 如果真的需要访问 _objectsMap（仅用于调试）

### 仅用于调试的方式

```javascript
/**
 * ⚠️ 仅用于调试！不要在生产代码中使用
 */
function debugObjectsMap() {
  const resolver = window.coda.documentModel.session.resolver;
  
  // 访问私有属性（不推荐）
  const objectsMap = resolver._objectsMap;
  
  if (!objectsMap) {
    console.log('❌ _objectsMap not accessible');
    return;
  }
  
  console.log(`Total entries in _objectsMap: ${objectsMap.size}`);
  
  // 遍历前 10 个条目
  let count = 0;
  for (const [id, entry] of objectsMap.entries()) {
    if (count >= 10) break;
    
    console.log(`\n[${count + 1}] ID: ${id}`);
    console.log(`  Type: ${entry.object.constructor.name}`);
    console.log(`  Name: ${entry.object.name || 'N/A'}`);
    console.log(`  Has Listener: ${!!entry.listener}`);
    
    count++;
  }
  
  if (objectsMap.size > 10) {
    console.log(`\n... and ${objectsMap.size - 10} more entries`);
  }
}

// 使用（仅用于调试）
debugObjectsMap();
```

### 对比公开API和私有属性

```javascript
/**
 * 对比使用公开API和直接访问私有属性的差异
 */
function compareAccessMethods(objectId) {
  const resolver = window.coda.documentModel.session.resolver;
  
  console.log(`=== Comparing access methods for: ${objectId} ===\n`);
  
  // 方法 1: 通过公开API（推荐）
  console.log('1. Using public API (typedGetters):');
  const gridViaAPI = resolver.typedGetters.tryGetGrid(objectId);
  console.log('  Result:', gridViaAPI ? `Grid "${gridViaAPI.name}"` : 'null (filtered)');
  
  // 方法 2: 通过 getById（通用方法）
  console.log('\n2. Using public getById:');
  const objViaGetById = resolver.getById(objectId);
  console.log('  Result:', objViaGetById ? `${objViaGetById.constructor.name} "${objViaGetById.name}"` : 'null');
  
  // 方法 3: 直接访问私有属性（不推荐）
  console.log('\n3. Direct _objectsMap access (NOT RECOMMENDED):');
  const entry = resolver._objectsMap?.get(objectId);
  if (entry) {
    console.log('  Result:', `${entry.object.constructor.name} "${entry.object.name}"`);
    console.log('  Is Deleted:', resolver.isDeleted(entry.object));
    console.log('  ⚠️  Warning: May include deleted objects!');
  } else {
    console.log('  Result: undefined');
  }
  
  // 对比结果
  console.log('\n=== Comparison ===');
  console.log(`Public API filtered deleted: ${!gridViaAPI && entry ? 'YES' : 'NO'}`);
}

// 使用
compareAccessMethods("table-GPDECroKmX");
```

---

## 📋 Resolver 公开API总结

| API | 返回值 | 说明 |
|-----|--------|------|
| `typedGetters.tryGetGrid(id)` | `Grid \| undefined` | 获取 Grid（安全） |
| `typedGetters.getGrid(id)` | `Grid` | 获取 Grid（不存在则抛错） |
| `typedGetters.tryGetColumn(gridId, colId)` | `Column \| undefined` | 获取 Column |
| `typedGetters.tryGetRow(gridId, rowId)` | `Row \| undefined` | 获取 Row |
| `typedGetters.tryGetPage(id)` | `Page \| undefined` | 获取 Page |
| `typedGetters.tryGetPageCanvas(id)` | `Canvas \| undefined` | 获取 Canvas |
| `getById(id, options)` | `Object \| null` | 通用获取（无类型） |
| `getAllObjects(options)` | `Object[]` | 获取所有对象 |
| `isDeleted(object)` | `boolean` | 检查是否已删除 |

---

## 🎯 最佳实践

### ✅ 推荐做法

```javascript
// 1. 优先使用 typedGetters
const grid = resolver.typedGetters.tryGetGrid(gridId);

// 2. 检查返回值
if (!grid) {
  console.log('Grid not found or deleted');
  return;
}

// 3. 使用对象的公开属性和方法
console.log('Grid name:', grid.name);
console.log('Columns:', grid.columns.count);

// 4. 如需遍历，使用 getAllObjects
const allObjects = resolver.getAllObjects();
```

### ❌ 避免的做法

```javascript
// 1. 不要直接访问私有属性
// ❌ const map = resolver._objectsMap;

// 2. 不要绕过删除检查
// ❌ const entry = resolver._objectsMap.get(id);
// ❌ const obj = entry.object;  // 可能是已删除的

// 3. 不要假设内部结构不变
// ❌ 依赖 _objectsMap 的结构可能在未来版本失效
```

---

## 🔍 调试技巧

### 1. 查看 Resolver 提供的方法

```javascript
const resolver = window.coda.documentModel.session.resolver;

// 查看所有公开方法
console.log('Resolver methods:');
Object.getOwnPropertyNames(Object.getPrototypeOf(resolver))
  .filter(name => typeof resolver[name] === 'function')
  .forEach(name => console.log(`  - ${name}`));

// 查看 typedGetters 的方法
console.log('\nTypedGetters methods:');
Object.keys(resolver.typedGetters)
  .forEach(name => console.log(`  - ${name}`));
```

### 2. 监控对象注册

```javascript
// 包装注册方法来记录新对象
const originalRegister = window.coda.documentModel.session.resolver._register;

if (originalRegister) {
  window.coda.documentModel.session.resolver._register = function(object) {
    console.log('🔵 Object registered:', object.id, object.constructor.name);
    return originalRegister.call(this, object);
  };
}
```

### 3. 统计对象数量

```javascript
function getObjectStats() {
  const resolver = window.coda.documentModel.session.resolver;
  const allObjects = resolver.getAllObjects({ includeDeleted: true });
  const active = allObjects.filter(obj => !resolver.isDeleted(obj));
  const deleted = allObjects.filter(obj => resolver.isDeleted(obj));
  
  console.log(`=== Object Statistics ===`);
  console.log(`Total: ${allObjects.length}`);
  console.log(`Active: ${active.length}`);
  console.log(`Deleted: ${deleted.length}`);
  
  // 按类型统计
  const byType = {};
  allObjects.forEach(obj => {
    const type = obj.constructor.name;
    byType[type] = (byType[type] || 0) + 1;
  });
  
  console.log('\nBy Type:');
  Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
}

// 使用
getObjectStats();
```

---

## 📝 总结

### 核心要点

1. **`_objectsMap` 是私有的**：以 `_` 开头表示内部实现
2. **不要直接访问**：使用公开API（`typedGetters`、`getById`）
3. **公开API更安全**：自动过滤已删除对象，提供类型检查
4. **内部结构可能变化**：依赖私有属性会导致代码脆弱

### 推荐访问路径

```
用户需求
  ↓
检查对象类型
  ↓
选择合适的 TypedGetter
  ↓
typedGetters.tryGetXXX(id)
  ↓
检查返回值
  ↓
使用对象
```

### 如果真的需要调试

- ✅ 使用 `getAllObjects()` 遍历所有对象
- ✅ 使用 `getById()` 获取特定对象
- ⚠️ 仅在控制台临时调试时访问 `_objectsMap`
- ❌ 永远不要在生产代码中依赖 `_objectsMap`

---

**文档创建时间**: 2025-10-16

**相关文档**:
- `slate_to_grid_access_guide.md` - Grid 访问指南
- `table_data_access_guide.md` - 表格数据访问
- `02_data_layer_deep_dive.md` - 数据层详细分析
