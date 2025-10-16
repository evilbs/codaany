# Coda Pack 架构与集成分析

## 概述

Coda Pack 是 Coda 的扩展系统,允许开发者创建自定义的集成来连接外部服务和 API。Pack 提供了公式(Formula)、同步表(SyncTable)和操作(Action)等能力,可以无缝集成到 Coda 的文档系统中。

---

## 一、Pack 的核心组件

### 1.1 Pack Formula (Pack 公式)

Pack Formula 是 Pack 提供给文档使用的计算函数,可以在文档的任何地方调用。

#### 核心 API

```javascript
// 创建基础公式
function makeFormula(definition) {
  // definition 包含:
  // - name: 公式名称
  // - description: 公式描述
  // - parameters: 参数列表
  // - resultType: 返回值类型 (String, Number, Boolean, Array, Object)
  // - execute: 执行函数
  // - connectionRequirement: 连接要求 (Optional/Required/None)
}

// 创建返回对象的公式
function makeObjectFormula(definition) {
  // 特殊处理返回对象类型的公式
  // 包含 schema 定义和 response handler
}

// 创建字符串公式
function makeStringFormula(definition) {
  // 返回字符串类型的公式
}

// 创建数字公式
function makeNumericFormula(definition) {
  // 返回数字类型的公式
}
```

#### 公式的结构

```javascript
const formulaDefinition = {
  name: "GetUserInfo",
  description: "获取用户信息",
  
  // 参数定义
  parameters: [
    makeParameter({
      type: ParameterType.String,
      name: "userId",
      description: "用户ID",
      optional: false,
      autocomplete: ..., // 自动完成功能
    })
  ],
  
  // 返回值类型和 schema
  resultType: ValueType.Object,
  schema: {
    type: ValueType.Object,
    properties: {
      name: { type: ValueType.String },
      email: { type: ValueType.String },
      age: { type: ValueType.Number }
    },
    displayProperty: "name",
    idProperty: "email"
  },
  
  // 执行函数
  execute: async function(args, context) {
    const [userId] = args;
    // 调用外部 API
    const response = await context.fetcher.fetch({
      method: "GET",
      url: `https://api.example.com/users/${userId}`
    });
    return response.body;
  },
  
  // 连接要求
  connectionRequirement: ConnectionRequirement.Required,
  
  // 错误处理
  onError: (error) => {
    // 自定义错误处理
  }
};
```

### 1.2 Sync Table (同步表)

Sync Table 允许从外部数据源同步数据到 Coda 表格中。

#### 核心 API

```javascript
function makeSyncTable({
  name,              // 表名
  displayName,       // 显示名称
  description,       // 描述
  identityName,      // 身份标识名
  schema,            // 表的 schema
  formula,           // 获取数据的公式
  connectionRequirement,  // 连接要求
  dynamicOptions,    // 动态选项 (getSchema, propertyOptions)
  role              // 表的角色 (Users, GroupMembers等)
})
```

#### Sync Table 的完整结构

```javascript
const syncTableDefinition = {
  name: "Users",
  displayName: "用户列表",
  description: "从外部系统同步用户数据",
  
  // 身份标识 - 用于去重和更新
  identityName: "User",
  
  // Schema 定义
  schema: {
    type: ValueType.Object,
    properties: {
      userId: { 
        type: ValueType.String,
        description: "用户ID"
      },
      name: { 
        type: ValueType.String,
        description: "用户名"
      },
      email: { 
        type: ValueType.String,
        codaType: ValueHintType.Email,
        description: "邮箱"
      },
      avatar: {
        type: ValueType.String,
        codaType: ValueHintType.ImageReference,
        description: "头像"
      },
      createdAt: {
        type: ValueType.String,
        codaType: ValueHintType.DateTime,
        description: "创建时间"
      }
    },
    displayProperty: "name",   // 显示属性
    idProperty: "userId",      // ID 属性
    featuredProperties: ["email", "createdAt"]
  },
  
  // 获取数据的公式
  formula: {
    name: "SyncUsers",
    description: "同步用户数据",
    
    parameters: [
      // 可以定义过滤参数
      makeParameter({
        type: ParameterType.String,
        name: "department",
        description: "按部门过滤",
        optional: true
      })
    ],
    
    execute: async function(args, context) {
      const [department] = args;
      
      // 支持分页
      const { continuation } = context.sync;
      
      // 调用 API
      const response = await context.fetcher.fetch({
        method: "GET",
        url: "https://api.example.com/users",
        params: {
          department,
          page: continuation?.nextPage || 1
        }
      });
      
      return {
        result: response.body.users,  // 返回数据数组
        continuation: response.body.hasMore ? {
          nextPage: response.body.currentPage + 1
        } : undefined
      };
    },
    
    // 更新操作 (双向同步)
    executeUpdate: async function(args, updates, context) {
      // 批量更新数据
      for (const update of updates) {
        await context.fetcher.fetch({
          method: "PATCH",
          url: `https://api.example.com/users/${update.id}`,
          body: update.newValue
        });
      }
    }
  },
  
  // 动态选项
  dynamicOptions: {
    // 动态获取 schema (用于动态表)
    getSchema: async function(context, args) {
      // 根据参数动态返回 schema
    },
    
    // 属性选项
    propertyOptions: async function(context) {
      // 返回可选择的属性列表
    }
  }
};
```

### 1.3 Dynamic Sync Table (动态同步表)

动态同步表的 schema 可以根据用户选择动态变化。

```javascript
function makeDynamicSyncTable({
  name,
  description,
  identityName,
  
  // 列出可用的表
  listDynamicUrls: async function(context) {
    return [
      { display: "项目", value: "projects" },
      { display: "任务", value: "tasks" }
    ];
  },
  
  // 根据选择获取 schema
  getSchema: async function(context, _, dynamicUrl) {
    if (dynamicUrl === "projects") {
      return {
        type: ValueType.Object,
        properties: {
          id: { type: ValueType.String },
          name: { type: ValueType.String },
          // ...
        }
      };
    }
  },
  
  // 获取数据
  formula: {
    execute: async function(args, context) {
      const dynamicUrl = context.sync.dynamicUrl;
      // 根据 dynamicUrl 获取不同的数据
    }
  }
});
```

### 1.4 Pack Parameter (Pack 参数)

```javascript
function makeParameter({
  type,              // 参数类型
  name,              // 参数名
  description,       // 描述
  optional,          // 是否可选
  
  // 自动完成
  autocomplete: async function(context, search) {
    return [
      { display: "选项1", value: "value1" },
      { display: "选项2", value: "value2" }
    ];
  },
  
  // 爬虫策略 (用于自动发现数据)
  crawlStrategy: {
    parentTable: {
      tableName: "Users",
      propertyKey: "userId",
      inheritPermissions: true
    }
  },
  
  allowManualInput: true  // 是否允许手动输入
})
```

支持的参数类型:
- `ParameterType.String` - 字符串
- `ParameterType.Number` - 数字
- `ParameterType.Boolean` - 布尔值
- `ParameterType.Date` - 日期
- `ParameterType.Html` - HTML
- `ParameterType.Image` - 图片
- `ParameterType.File` - 文件
- `ParameterType.StringArray` - 字符串数组
- 等等...

---

## 二、Pack 与公式系统的集成

### 2.1 公式包装流程

Pack Formula 会被包装成标准的 Coda 公式,主要经过以下步骤:

```javascript
// 1. 参数标准化
function normalizeParameters(packParameters) {
  return packParameters.map(param => {
    return {
      ...param,
      type: ParameterTypeInputMap[param.type],  // 转换类型
      autocomplete: wrapMetadataFunction(param.autocomplete),  // 包装自动完成
      crawlStrategy: normalizeCrawlStrategy(param.crawlStrategy)
    };
  });
}

// 2. 返回值 Schema 标准化
function normalizeResultSchema(packSchema) {
  return normalizeSchema(deepCopy(packSchema));
}

// 3. 执行函数包装
function wrapExecuteFunction(packExecute, resultType, schema, onError) {
  return async function(args, context) {
    let result;
    
    try {
      // 执行 Pack 函数
      result = await packExecute(args, context);
    } catch (error) {
      // 错误处理
      if (onError) {
        result = onError(error);
      } else {
        throw error;
      }
    }
    
    // 对于对象返回值,使用 response handler 处理
    if (resultType === Type.object) {
      const responseHandler = generateObjectResponseHandler({ schema });
      result = responseHandler({
        body: result || {},
        status: 200,
        headers: {}
      });
    }
    
    return result;
  };
}

// 4. 完整的公式对象
function createFormulaFromPack(packFormula) {
  return {
    name: packFormula.name,
    description: packFormula.description,
    parameters: normalizeParameters(packFormula.parameters),
    resultType: Type.object,  // 统一转换为标准类型
    schema: normalizeResultSchema(packFormula.schema),
    execute: wrapExecuteFunction(
      packFormula.execute,
      packFormula.resultType,
      packFormula.schema,
      packFormula.onError
    ),
    connectionRequirement: packFormula.connectionRequirement,
    validateParameters: wrapMetadataFunction(packFormula.validateParameters)
  };
}
```

### 2.2 公式执行上下文

Pack Formula 的执行函数会接收一个 context 对象:

```javascript
const context = {
  // HTTP 请求客户端
  fetcher: {
    fetch: async function(request) {
      // 发送 HTTP 请求
      // 自动处理认证、重试、限流等
    }
  },
  
  // 临时存储
  temporaryBlobStorage: {
    storeUrl: async function(url) { },
    storeBlob: async function(blob) { }
  },
  
  // 同步上下文 (仅 SyncTable)
  sync: {
    dynamicUrl: "...",      // 动态表的 URL
    schema: { ... },        // 当前 schema
    continuation: { ... }   // 分页标记
  },
  
  // 时区
  timezone: "America/Los_Angeles",
  
  // 调用位置
  invocationLocation: {
    protocolAndHost: "https://coda.io"
  },
  
  // 同步更新 (仅 executeUpdate)
  propertyOptions: { ... }
};
```

### 2.3 错误处理

Pack 支持多种错误类型:

```javascript
// 1. 用户可见错误
class UserVisibleError extends Error {
  constructor(message, internalError) {
    super(message);
    this.isUserVisible = true;
    this.internalError = internalError;
  }
}

// 2. HTTP 状态码错误
class StatusCodeError extends Error {
  constructor(statusCode, body, options, response) {
    super(`${statusCode} - ${JSON.stringify(body)}`);
    this.statusCode = statusCode;
    this.body = body;
    this.error = body;
    this.options = options;
    this.response = response;
  }
}

// 3. 权限不足错误
class MissingScopesError extends Error {
  constructor(message = "Additional permissions are required") {
    super(message);
  }
}

// 4. Google DWD 错误
class GoogleDwdError extends Error {
  constructor(message = "Google DWD error") {
    super(message);
  }
}

// 5. 响应过大错误
class ResponseSizeTooLargeError extends Error {
  constructor(message = "Response size too large") {
    super(message);
  }
}
```

---

## 三、Pack 与其他 Coda 能力的集成

### 3.1 与表格(Grid)的集成

#### SyncTable → Grid

```javascript
// 1. SyncTable 创建 Grid
// 当用户在文档中插入一个 SyncTable 时,Coda 会:

// a. 创建 Grid 对象
const grid = createGrid({
  name: syncTable.displayName,
  columns: createColumnsFromSchema(syncTable.schema),
  identityName: syncTable.identityName
});

// b. 首次同步
const syncResult = await syncTable.formula.execute([], context);
const rows = syncResult.result;

// c. 填充数据
for (const rowData of rows) {
  grid.addRow(rowData);
}

// 2. Schema → Grid Columns
function createColumnsFromSchema(schema) {
  const columns = [];
  
  for (const [propertyKey, propertySchema] of Object.entries(schema.properties)) {
    columns.push({
      id: generateColumnId(),
      name: propertyKey,
      valueFormat: convertSchemaToValueFormat(propertySchema),
      formula: null  // SyncTable 列不使用公式
    });
  }
  
  return columns;
}

// 3. 数据类型转换
function convertSchemaToValueFormat(propertySchema) {
  switch (propertySchema.type) {
    case ValueType.String:
      if (propertySchema.codaType === ValueHintType.Email) {
        return { type: 'Email' };
      } else if (propertySchema.codaType === ValueHintType.Url) {
        return { type: 'Link' };
      }
      return { type: 'Text' };
      
    case ValueType.Number:
      if (propertySchema.codaType === ValueHintType.Currency) {
        return { 
          type: 'Currency',
          currencyCode: propertySchema.currencyCode || 'USD'
        };
      } else if (propertySchema.codaType === ValueHintType.Percent) {
        return { type: 'Percent' };
      }
      return { type: 'Number' };
      
    case ValueType.Boolean:
      return { type: 'Checkbox' };
      
    case ValueType.Array:
      return {
        type: 'Array',
        items: convertSchemaToValueFormat(propertySchema.items)
      };
      
    default:
      return { type: 'Text' };
  }
}
```

#### 双向同步

```javascript
// 当用户编辑 SyncTable 中的单元格时:

async function onCellEdit(gridId, rowId, columnId, newValue) {
  const syncTable = getSyncTableForGrid(gridId);
  
  if (syncTable.formula.executeUpdate) {
    // 调用 Pack 的更新函数
    await syncTable.formula.executeUpdate(
      [], // args
      [{
        id: rowId,
        newValue: {
          [columnId]: newValue
        }
      }],
      context
    );
    
    // 触发重新同步
    await resyncTable(gridId);
  } else {
    // 只读表,不支持编辑
    throw new Error("This sync table is read-only");
  }
}
```

### 3.2 与公式引擎的集成

Pack Formula 在公式引擎中的注册和调用:

```javascript
// 1. Pack 公式注册
class FormulaEngine {
  registerPackFormulas(pack) {
    for (const formula of pack.formulas) {
      // 创建公式定义
      const formulaDef = {
        name: `${pack.name}.${formula.name}`,  // 带命名空间
        impl: createFormulaFromPack(formula),
        packId: pack.id
      };
      
      // 注册到公式表
      this.formulaRegistry.set(formulaDef.name, formulaDef);
    }
  }
  
  // 2. 公式调用
  async evaluateFormula(formulaName, args, context) {
    const formulaDef = this.formulaRegistry.get(formulaName);
    
    if (!formulaDef) {
      throw new Error(`Formula ${formulaName} not found`);
    }
    
    // 验证参数
    if (formulaDef.impl.validateParameters) {
      await formulaDef.impl.validateParameters(args);
    }
    
    // 执行公式
    const result = await formulaDef.impl.execute(args, context);
    
    return result;
  }
}

// 3. 在单元格中使用 Pack 公式
// 用户在单元格中输入: =GitHub.GetIssue("123")
// Coda 解析为:
{
  type: "Formula",
  formulaName: "GitHub.GetIssue",
  args: [
    { type: "Literal", value: "123" }
  ]
}

// 公式引擎执行:
const result = await formulaEngine.evaluateFormula(
  "GitHub.GetIssue",
  ["123"],
  context
);
```

### 3.3 与按钮(Button)的集成

Pack Formula 可以被按钮调用:

```javascript
// 1. 按钮配置
const button = {
  type: "Button",
  label: "创建Issue",
  action: {
    type: "PackFormula",
    formulaName: "GitHub.CreateIssue",
    args: [
      { type: "CellReference", columnId: "title-col" },
      { type: "CellReference", columnId: "description-col" }
    ]
  }
};

// 2. 按钮点击处理
async function onButtonClick(button, row) {
  const { formulaName, args } = button.action;
  
  // 解析参数
  const resolvedArgs = args.map(arg => {
    if (arg.type === "CellReference") {
      return row.getCellValue(arg.columnId);
    }
    return arg.value;
  });
  
  // 执行 Pack 公式
  const result = await formulaEngine.evaluateFormula(
    formulaName,
    resolvedArgs,
    context
  );
  
  // 显示结果
  showNotification(`Issue created: ${result.url}`);
}
```

### 3.4 与 Automation (规则) 的集成

Pack 可以在自动化规则中使用:

```javascript
// 规则定义
const rule = {
  when: {
    type: "RowAdded",
    gridId: "users-table"
  },
  if: {
    type: "Formula",
    formula: "=[@Status] = 'New'"
  },
  then: [
    {
      type: "CallPackFormula",
      formulaName: "Slack.SendMessage",
      args: [
        "#新用户",
        "=CONCATENATE('新用户注册:', [@Name])"
      ]
    }
  ]
};

// 规则执行
async function executeRule(rule, row) {
  // 1. 检查触发条件
  if (rule.when.type === "RowAdded") {
    // 新行添加
  }
  
  // 2. 检查 if 条件
  if (rule.if) {
    const conditionResult = await evaluateFormula(rule.if.formula, { row });
    if (!conditionResult) {
      return;  // 条件不满足
    }
  }
  
  // 3. 执行 then 动作
  for (const action of rule.then) {
    if (action.type === "CallPackFormula") {
      // 解析参数
      const args = await Promise.all(
        action.args.map(arg => evaluateFormula(arg, { row }))
      );
      
      // 调用 Pack 公式
      await formulaEngine.evaluateFormula(
        action.formulaName,
        args,
        context
      );
    }
  }
}
```

### 3.5 与 AI/Brain 的集成

从代码中可以看到 Pack 还可以作为 AI Brain 的数据源:

```javascript
// ChatTargetPicker 组件中使用 Pack
case ChatTarget.Pack:
  const { pack } = chatTarget;
  return {
    name: pack.name,
    icon: getPackIcon(pack)
  };

// Pack 作为知识源
function getChatTargetOptions() {
  const packIdToPackListingInfo = {};
  
  // 从 Pack 获取可查询的数据
  for (const ingestion of queryableRootIngestions) {
    const packId = ingestion.pack?.id;
    if (packId && ingestion.pack) {
      packIdToPackListingInfo[packId] = ingestion.pack;
    }
  }
  
  // 创建 Pack 聊天目标
  const packTargets = Object.values(packIdToPackListingInfo).map(pack => ({
    type: ChatTarget.Pack,
    pack: pack
  }));
  
  return packTargets;
}
```

---

## 四、Pack 的连接和认证

### 4.1 连接类型

```javascript
const ConnectionRequirement = {
  None: "none",        // 不需要连接
  Optional: "optional", // 可选连接
  Required: "required"  // 必需连接
};
```

### 4.2 认证流程

```javascript
// 1. Pack 定义认证配置
const packDefinition = {
  networkDomains: ["api.example.com"],
  
  defaultAuthentication: {
    type: AuthenticationType.OAuth2,
    authorizationUrl: "https://example.com/oauth/authorize",
    tokenUrl: "https://example.com/oauth/token",
    scopes: ["read", "write"],
    
    // 获取连接名称
    getConnectionName: async function(context) {
      const response = await context.fetcher.fetch({
        method: "GET",
        url: "https://api.example.com/me"
      });
      return response.body.username;
    }
  }
};

// 2. 用户认证流程
async function authenticatePack(packId) {
  const pack = getPackById(packId);
  const auth = pack.defaultAuthentication;
  
  if (auth.type === AuthenticationType.OAuth2) {
    // a. 重定向到授权页面
    const authUrl = buildAuthorizationUrl(auth);
    window.open(authUrl);
    
    // b. 接收授权码
    const authCode = await waitForAuthCallback();
    
    // c. 交换 access token
    const tokenResponse = await fetch(auth.tokenUrl, {
      method: "POST",
      body: {
        code: authCode,
        client_id: pack.clientId,
        client_secret: pack.clientSecret,
        grant_type: "authorization_code"
      }
    });
    
    const { access_token, refresh_token } = tokenResponse;
    
    // d. 保存连接
    const connectionName = await auth.getConnectionName(context);
    saveConnection(packId, {
      name: connectionName,
      accessToken: access_token,
      refreshToken: refresh_token
    });
  }
}

// 3. 请求时使用连接
async function executePack FormulaWithAuth(formula, args) {
  const connection = getConnection(formula.packId);
  
  const context = {
    fetcher: {
      fetch: async function(request) {
        // 自动添加认证头
        request.headers = {
          ...request.headers,
          Authorization: `Bearer ${connection.accessToken}`
        };
        
        try {
          return await fetch(request);
        } catch (error) {
          if (error.statusCode === 401) {
            // Token 过期,刷新 token
            await refreshToken(connection);
            // 重试
            return await fetch(request);
          }
          throw error;
        }
      }
    }
  };
  
  return await formula.execute(args, context);
}
```

---

## 五、Pack 的生命周期管理

### 5.1 Pack 加载

```javascript
// 1. 加载 Pack 定义
async function loadPack(packId) {
  // 从服务器获取 Pack 代码
  const packCode = await fetchPackCode(packId);
  
  // 在沙箱中执行
  const packManifest = executePackCodeInSandbox(packCode);
  
  // 注册 Pack
  registerPack(packManifest);
  
  return packManifest;
}

// 2. Pack 沙箱环境
function executePackCodeInSandbox(packCode) {
  const sandbox = {
    // 提供 Pack SDK API
    makeFormula,
    makeSyncTable,
    makeParameter,
    // ... 其他 API
    
    // 限制访问
    window: undefined,
    document: undefined,
    process: undefined
  };
  
  // 执行 Pack 代码
  const packFunction = new Function(
    ...Object.keys(sandbox),
    packCode
  );
  
  return packFunction(...Object.values(sandbox));
}
```

### 5.2 Pack 缓存

```javascript
// SyncTable 有缓存机制
const syncTableGetter = {
  cacheTtlSecs: 3600,  // 缓存 1 小时
  
  execute: async function(args, context) {
    const cacheKey = generateCacheKey(args);
    
    // 检查缓存
    const cached = await getFromCache(cacheKey);
    if (cached && !isCacheExpired(cached)) {
      return cached.data;
    }
    
    // 获取新数据
    const result = await fetchData(args, context);
    
    // 保存到缓存
    await saveToCache(cacheKey, result, this.cacheTtlSecs);
    
    return result;
  }
};
```

---

## 六、总结

### Pack 的核心价值

1. **扩展性**: 允许第三方开发者为 Coda 添加新功能
2. **一致性**: Pack 提供的功能与 Coda 原生功能无缝集成
3. **安全性**: 通过沙箱和认证机制保证安全
4. **易用性**: 统一的 API 和开发体验

### Pack 与 Coda 核心系统的集成点

1. **公式引擎**: Pack Formula 注册为可调用的公式
2. **表格系统**: SyncTable 创建和管理表格数据
3. **按钮系统**: Pack Formula 可被按钮触发
4. **自动化系统**: Pack Formula 可在规则中使用
5. **AI 系统**: Pack 可作为 AI 的知识源
6. **认证系统**: 统一的连接和认证管理

### Pack 的执行流程

```
用户操作 (公式/按钮/规则)
  ↓
解析 Pack Formula 调用
  ↓
验证参数
  ↓
获取/刷新认证 Token
  ↓
执行 Pack Formula
  ↓
调用外部 API
  ↓
处理响应数据
  ↓
应用 Schema 转换
  ↓
返回结果给用户
  ↓
更新 UI (表格/单元格等)
```

这种设计让 Pack 能够作为 Coda 的"插件系统",极大地扩展了 Coda 的能力边界。
