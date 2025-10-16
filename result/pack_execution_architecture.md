# Coda Pack 执行架构：前端 vs 后端

## 核心答案

**Pack 代码的执行是在后端（服务端）进行的，而不是在前端（浏览器）**。

但 Pack 的定义和 SDK 是在前端可见的，这是一个**混合架构**。

---

## 详细分析

### 1. 前端部分（浏览器中）

#### 1.1 Pack SDK API 定义

从代码中可以看到，Pack SDK 的 API 定义确实在前端的 bundle 文件中：

```javascript
// browser.6611b23ea80de0482abc.entry.js 包含:
__webpack_modules__ = {
  905044: function(e, t, n) {
    "use strict";
    Object.defineProperty(t, "__esModule", {value: !0}),
    
    // Pack SDK 导出的 API
    t.makeSyncTable = ...
    t.makeFormula = ...
    t.makeObjectFormula = ...
    t.makeParameter = ...
    t.makeStringFormula = ...
    t.makeNumericFormula = ...
    // ... 等等
  }
}
```

**这些代码在前端的作用是：**

1. **类型定义和验证**: 前端需要知道 Pack 的 schema 结构
2. **UI 渲染**: 展示 Pack 的名称、描述、参数等信息
3. **参数验证**: 在调用前验证参数类型和必填项
4. **自动完成**: 提供参数的自动完成建议

#### 1.2 Pack Manifest（元数据）

前端存储和使用 Pack 的元数据：

```javascript
// Pack 元数据示例
const packManifest = {
  id: "pack-123",
  name: "GitHub",
  description: "GitHub integration",
  
  // 公式列表
  formulas: [
    {
      name: "GetIssue",
      description: "Get a GitHub issue",
      parameters: [
        {
          name: "issueNumber",
          type: "string",
          description: "Issue number"
        }
      ],
      resultType: "object",
      schema: { ... }
    }
  ],
  
  // 同步表列表
  syncTables: [ ... ],
  
  // 认证配置
  defaultAuthentication: {
    type: "OAuth2",
    authorizationUrl: "...",
    // 注意：不包含 client_secret
  }
};
```

**前端使用这些元数据来：**

- 在公式编辑器中提供自动完成
- 显示参数提示
- 渲染 SyncTable 的配置界面
- 管理用户的连接（显示已连接的账号）

### 2. 后端部分（服务器）

#### 2.1 Pack 代码存储

Pack 的实际执行代码存储在服务器上：

```
Coda 服务器
├── Pack Registry
│   ├── pack-123/
│   │   ├── manifest.json (元数据)
│   │   ├── bundle.js (Pack 执行代码)
│   │   └── version-history/
│   ├── pack-456/
│   └── ...
```

#### 2.2 Pack 执行流程

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   浏览器     │         │  Coda Server │         │ Pack Runtime│
└──────┬──────┘         └──────┬───────┘         └──────┬──────┘
       │                       │                        │
       │ 1. 调用 Pack 公式      │                        │
       │ =GitHub.GetIssue("123")│                       │
       ├──────────────────────>│                        │
       │                       │                        │
       │                       │ 2. 查找 Pack 定义       │
       │                       │ (pack-123, GetIssue)   │
       │                       │                        │
       │                       │ 3. 加载 Pack 代码       │
       │                       ├───────────────────────>│
       │                       │                        │
       │                       │ 4. 创建执行上下文       │
       │                       │ - 获取用户认证 token    │
       │                       │ - 注入 fetcher         │
       │                       │ - 设置沙箱环境         │
       │                       │                        │
       │                       │ 5. 执行 Pack formula   │
       │                       │    execute(["123"])    │
       │                       │                        │
       │                       │        ┌──────────────┐│
       │                       │        │ 沙箱环境      ││
       │                       │        │ - VM isolate ││
       │                       │        │ - 限制访问    ││
       │                       │        │ - 超时控制    ││
       │                       │        └──────────────┘│
       │                       │                        │
       │                       │ 6. Pack 调用外部 API   │
       │                       │    context.fetcher     │
       │                       │    .fetch(github.com)  │
       │                       │                        │
       │                       │ 7. 返回结果            │
       │                       │<───────────────────────│
       │                       │                        │
       │ 8. 返回给浏览器        │                        │
       │<──────────────────────┤                        │
       │                       │                        │
       │ 9. 渲染结果到单元格    │                        │
       │                       │                        │
```

#### 2.3 服务端执行的关键组件

```javascript
// 服务端 Pack 执行器 (伪代码)
class PackExecutor {
  async executeFormula(packId, formulaName, args, context) {
    // 1. 加载 Pack 代码
    const packCode = await this.loadPackCode(packId);
    
    // 2. 获取用户认证
    const connection = await this.getConnection(packId, context.userId);
    
    // 3. 创建沙箱环境
    const sandbox = this.createSandbox({
      // 提供安全的 fetcher
      fetcher: this.createSecureFetcher(connection),
      
      // 注入 Pack SDK
      makeFormula: require('@codahq/packs-sdk').makeFormula,
      // ... 其他 SDK API
      
      // 限制访问
      process: undefined,
      require: undefined,
      __dirname: undefined,
    });
    
    // 4. 在沙箱中执行 Pack 代码
    const packManifest = await sandbox.execute(packCode);
    
    // 5. 找到对应的公式
    const formula = packManifest.formulas.find(f => f.name === formulaName);
    
    // 6. 执行公式
    const result = await formula.execute(args, {
      fetcher: sandbox.fetcher,
      timezone: context.timezone,
      // ... 其他上下文
    });
    
    // 7. 返回结果
    return result;
  }
  
  async loadPackCode(packId) {
    // 从数据库或文件系统加载 Pack 代码
    return await PackStorage.getPackCode(packId);
  }
  
  createSecureFetcher(connection) {
    return {
      fetch: async (request) => {
        // 自动添加认证
        if (connection) {
          request.headers.Authorization = `Bearer ${connection.accessToken}`;
        }
        
        // 限流
        await this.rateLimiter.checkLimit(connection);
        
        // 执行请求
        const response = await fetch(request);
        
        // 限制响应大小
        if (response.body.length > MAX_RESPONSE_SIZE) {
          throw new ResponseSizeTooLargeError();
        }
        
        return response;
      }
    };
  }
}
```

---

## 为什么要在服务端执行？

### 1. **安全性** 🔒

```javascript
// ❌ 如果在前端执行 - 危险！
// 用户可以看到和修改所有代码
const apiKey = "sk_live_51H...";  // 暴露了密钥！

// ✅ 在服务端执行 - 安全
// API 密钥存储在服务器，前端看不到
```

**服务端执行的安全优势：**

- **保护密钥**: OAuth secrets, API keys 等敏感信息存储在服务器
- **访问控制**: 服务器验证用户权限
- **防止滥用**: 服务器可以限流、监控、审计
- **沙箱隔离**: 防止恶意代码影响其他用户

### 2. **认证管理** 🔑

```javascript
// 服务端安全地管理 OAuth tokens
class ConnectionManager {
  async getAccessToken(packId, userId) {
    // 从加密存储中获取
    const connection = await DB.connections.findOne({
      packId,
      userId
    });
    
    // 检查是否过期
    if (connection.isExpired()) {
      // 自动刷新 token
      connection = await this.refreshToken(connection);
    }
    
    // 返回可用的 token
    return connection.accessToken;
  }
}
```

### 3. **性能和可靠性** ⚡

**服务端优势：**

- **稳定的网络**: 服务器到 API 的网络更稳定
- **批量处理**: 可以优化批量请求
- **缓存**: 服务端可以缓存结果
- **重试机制**: 自动处理失败和重试
- **并发控制**: 避免超出 API 限制

### 4. **隐私保护** 🛡️

```javascript
// 服务端可以过滤敏感信息
async function executeFormula(formula, args, context) {
  const result = await formula.execute(args, context);
  
  // 移除敏感字段
  return sanitizeResult(result, {
    removeFields: ['internalId', 'secretToken'],
    maskFields: ['email', 'phone']
  });
}
```

---

## 混合架构的优势

### 前端负责：

1. ✅ **UI 交互**: 参数输入、自动完成
2. ✅ **即时反馈**: 参数验证、类型检查
3. ✅ **离线能力**: 显示 Pack 元数据，无需网络
4. ✅ **性能**: UI 响应快，不需要等待服务器

### 后端负责：

1. ✅ **执行安全**: 在隔离环境中执行代码
2. ✅ **认证管理**: 安全存储和使用 credentials
3. ✅ **数据处理**: 调用外部 API，处理大量数据
4. ✅ **监控审计**: 记录执行日志，检测异常

---

## 实际的数据流

### 场景：用户在单元格输入公式 `=GitHub.GetIssue("123")`

```
1. 前端 (浏览器)
   ├─ 解析公式: GitHub.GetIssue
   ├─ 查找 Pack manifest (本地缓存)
   ├─ 验证参数: "123" 是否是有效的字符串
   ├─ 显示加载状态
   └─ 发送请求到服务器
      POST /api/formulas/execute
      {
        "packId": "pack-github-123",
        "formula": "GetIssue",
        "args": ["123"],
        "docId": "doc-456",
        "userId": "user-789"
      }

2. 服务端 (Coda Server)
   ├─ 认证用户
   ├─ 加载 Pack 代码
   ├─ 获取用户的 GitHub 连接
   ├─ 创建执行上下文
   │  └─ fetcher (带 GitHub token)
   ├─ 在沙箱中执行
   │  └─ formula.execute(["123"], context)
   │     └─ context.fetcher.fetch("https://api.github.com/repos/.../issues/123")
   ├─ 处理结果
   │  └─ 应用 schema 转换
   └─ 返回给前端

3. 前端 (浏览器)
   ├─ 接收结果
   ├─ 渲染到单元格
   └─ 更新依赖的公式
```

---

## 总结

| 功能 | 前端 | 后端 |
|-----|------|------|
| Pack SDK API 定义 | ✅ 有（用于类型检查） | ✅ 有（用于执行） |
| Pack 元数据 (manifest) | ✅ 缓存副本 | ✅ 权威来源 |
| Pack 执行代码 (bundle.js) | ❌ 没有 | ✅ 有 |
| 公式执行 | ❌ 不执行 | ✅ 执行 |
| 参数验证 | ✅ 前置验证 | ✅ 最终验证 |
| API 调用 | ❌ 不直接调用 | ✅ 通过 fetcher |
| 认证 Token | ❌ 看不到 | ✅ 安全管理 |
| UI 交互 | ✅ 处理 | ❌ 不处理 |

**关键点：**

1. 📦 **Pack SDK 在前端和后端都存在**，但用途不同
2. 🔐 **Pack 代码只在服务端执行**，确保安全
3. 🎨 **前端负责 UI 和用户体验**
4. ⚙️ **后端负责实际的业务逻辑和 API 调用**
5. 🔄 **两者通过 API 请求通信**

这种架构设计既保证了安全性，又提供了良好的用户体验！
