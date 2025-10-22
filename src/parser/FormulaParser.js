/**
 * 公式解析器 - 将公式字符串解析为 AST
 */

class Token {
  constructor(type, value, start, end) {
    this.type = type;
    this.value = value;
    this.start = start;
    this.end = end;
  }
}

const TokenType = {
  FUNCTION_NAME: 'FUNCTION_NAME',
  OBJECT_REF: 'OBJECT_REF',
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  BOOLEAN: 'BOOLEAN',
  OPERATOR: 'OPERATOR',
  LPAREN: 'LPAREN',
  RPAREN: 'RPAREN',
  COMMA: 'COMMA',
  DOT: 'DOT',
  IDENTIFIER: 'IDENTIFIER',
  EOF: 'EOF'
};

class FormulaParser {
  constructor() {
    this.tokens = [];
    this.current = 0;
  }

  /**
   * 解析公式字符串
   */
  parse(formula) {
    try {
      this.tokens = this._tokenize(formula);
      this.current = 0;
      const ast = this._parseExpression();
      
      return {
        ast: ast,
        error: null,
        tokens: this.tokens
      };
    } catch (error) {
      return {
        ast: null,
        error: error.message,
        tokens: this.tokens
      };
    }
  }

  /**
   * 词法分析 - 将字符串转换为 Token 列表
   */
  _tokenize(formula) {
    const tokens = [];
    let i = 0;

    while (i < formula.length) {
      const char = formula[i];

      // 跳过空白字符
      if (/\s/.test(char)) {
        i++;
        continue;
      }

      // 对象引用: $$[grid:grid-xxx:::false:false:Name]
      if (formula.substr(i, 3) === '$$[') {
        const start = i;
        let end = formula.indexOf(']', i);
        if (end === -1) {
          throw new Error(`Unclosed object reference at position ${i}`);
        }
        end++; // 包含 ']'
        
        const value = formula.substring(start, end);
        tokens.push(new Token(TokenType.OBJECT_REF, value, start, end));
        i = end;
        continue;
      }

      // 字符串: "hello"
      if (char === '"' || char === "'") {
        const quote = char;
        const start = i;
        i++; // 跳过开始引号
        let value = '';
        
        while (i < formula.length && formula[i] !== quote) {
          if (formula[i] === '\\' && i + 1 < formula.length) {
            i++; // 跳过转义符
            value += formula[i];
          } else {
            value += formula[i];
          }
          i++;
        }
        
        if (i >= formula.length) {
          throw new Error(`Unclosed string at position ${start}`);
        }
        
        i++; // 跳过结束引号
        tokens.push(new Token(TokenType.STRING, value, start, i));
        continue;
      }

      // 数字: 123, 123.45
      if (/\d/.test(char)) {
        const start = i;
        let value = '';
        
        while (i < formula.length && /[\d.]/.test(formula[i])) {
          value += formula[i];
          i++;
        }
        
        tokens.push(new Token(TokenType.NUMBER, parseFloat(value), start, i));
        continue;
      }

      // 操作符: +, -, *, /, ==, !=, >, <, >=, <=
      if ('+-*/'.includes(char)) {
        tokens.push(new Token(TokenType.OPERATOR, char, i, i + 1));
        i++;
        continue;
      }

      if (char === '=' && formula[i + 1] === '=') {
        tokens.push(new Token(TokenType.OPERATOR, '==', i, i + 2));
        i += 2;
        continue;
      }

      if (char === '!' && formula[i + 1] === '=') {
        tokens.push(new Token(TokenType.OPERATOR, '!=', i, i + 2));
        i += 2;
        continue;
      }

      if (char === '>' && formula[i + 1] === '=') {
        tokens.push(new Token(TokenType.OPERATOR, '>=', i, i + 2));
        i += 2;
        continue;
      }

      if (char === '<' && formula[i + 1] === '=') {
        tokens.push(new Token(TokenType.OPERATOR, '<=', i, i + 2));
        i += 2;
        continue;
      }

      if (char === '>' || char === '<') {
        tokens.push(new Token(TokenType.OPERATOR, char, i, i + 1));
        i++;
        continue;
      }

      // 括号和逗号
      if (char === '(') {
        tokens.push(new Token(TokenType.LPAREN, char, i, i + 1));
        i++;
        continue;
      }

      if (char === ')') {
        tokens.push(new Token(TokenType.RPAREN, char, i, i + 1));
        i++;
        continue;
      }

      if (char === ',') {
        tokens.push(new Token(TokenType.COMMA, char, i, i + 1));
        i++;
        continue;
      }

      if (char === '.') {
        tokens.push(new Token(TokenType.DOT, char, i, i + 1));
        i++;
        continue;
      }

      // 标识符: AddRow, true, false
      if (/[a-zA-Z_]/.test(char)) {
        const start = i;
        let value = '';
        
        while (i < formula.length && /[a-zA-Z0-9_]/.test(formula[i])) {
          value += formula[i];
          i++;
        }

        // 检查是否是布尔值
        if (value === 'true' || value === 'false') {
          tokens.push(new Token(TokenType.BOOLEAN, value === 'true', start, i));
        } else {
          // 检查下一个 token 是否是左括号，如果是则这是函数名
          let j = i;
          while (j < formula.length && /\s/.test(formula[j])) j++;
          
          if (j < formula.length && formula[j] === '(') {
            tokens.push(new Token(TokenType.FUNCTION_NAME, value, start, i));
          } else {
            tokens.push(new Token(TokenType.IDENTIFIER, value, start, i));
          }
        }
        continue;
      }

      throw new Error(`Unexpected character '${char}' at position ${i}`);
    }

    tokens.push(new Token(TokenType.EOF, null, formula.length, formula.length));
    return tokens;
  }

  /**
   * 语法分析 - 解析表达式
   */
  _parseExpression() {
    return this._parseAdditive();
  }

  /**
   * 解析加减表达式
   */
  _parseAdditive() {
    let left = this._parseMultiplicative();

    while (this._match(TokenType.OPERATOR) && 
           (this._peek().value === '+' || this._peek().value === '-')) {
      const operator = this._advance().value;
      const right = this._parseMultiplicative();
      
      left = {
        type: 'BinaryExpression',
        operator: operator,
        left: left,
        right: right
      };
    }

    return left;
  }

  /**
   * 解析乘除表达式
   */
  _parseMultiplicative() {
    let left = this._parseComparison();

    while (this._match(TokenType.OPERATOR) && 
           (this._peek().value === '*' || this._peek().value === '/')) {
      const operator = this._advance().value;
      const right = this._parseComparison();
      
      left = {
        type: 'BinaryExpression',
        operator: operator,
        left: left,
        right: right
      };
    }

    return left;
  }

  /**
   * 解析比较表达式
   */
  _parseComparison() {
    let left = this._parsePrimary();

    while (this._match(TokenType.OPERATOR)) {
      const op = this._peek().value;
      if (['==', '!=', '>', '<', '>=', '<='].includes(op)) {
        this._advance();
        const right = this._parsePrimary();
        
        left = {
          type: 'BinaryExpression',
          operator: op,
          left: left,
          right: right
        };
      } else {
        break;
      }
    }

    return left;
  }

  /**
   * 解析基本表达式
   */
  _parsePrimary() {
    // 函数调用
    if (this._match(TokenType.FUNCTION_NAME)) {
      return this._parseFunctionCall();
    }

    // 对象引用
    if (this._match(TokenType.OBJECT_REF)) {
      return this._parseObjectReference();
    }

    // 字符串
    if (this._match(TokenType.STRING)) {
      const token = this._advance();
      return {
        type: 'Literal',
        valueType: 'string',
        value: token.value
      };
    }

    // 数字
    if (this._match(TokenType.NUMBER)) {
      const token = this._advance();
      return {
        type: 'Literal',
        valueType: 'number',
        value: token.value
      };
    }

    // 布尔值
    if (this._match(TokenType.BOOLEAN)) {
      const token = this._advance();
      return {
        type: 'Literal',
        valueType: 'boolean',
        value: token.value
      };
    }

    // 括号表达式
    if (this._match(TokenType.LPAREN)) {
      this._advance(); // 消费 '('
      const expr = this._parseExpression();
      
      if (!this._match(TokenType.RPAREN)) {
        throw new Error('Expected )');
      }
      this._advance(); // 消费 ')'
      
      return expr;
    }

    throw new Error(`Unexpected token: ${this._peek().type}`);
  }

  /**
   * 解析函数调用
   */
  _parseFunctionCall() {
    const nameToken = this._advance();
    const name = nameToken.value;

    if (!this._match(TokenType.LPAREN)) {
      throw new Error('Expected ( after function name');
    }
    this._advance(); // 消费 '('

    const args = [];
    
    // 解析参数列表
    if (!this._match(TokenType.RPAREN)) {
      do {
        // 跳过逗号（如果有）
        if (this._match(TokenType.COMMA)) {
          this._advance();
        }
        
        if (!this._match(TokenType.RPAREN)) {
          args.push(this._parseExpression());
        }
      } while (this._match(TokenType.COMMA));
    }

    if (!this._match(TokenType.RPAREN)) {
      throw new Error('Expected ) after function arguments');
    }
    this._advance(); // 消费 ')'

    return {
      type: 'FunctionCall',
      name: name,
      arguments: args
    };
  }

  /**
   * 解析对象引用
   */
  _parseObjectReference() {
    const token = this._advance();
    const serialized = token.value;
    
    // 解析 $$[type:objectId:fieldId::false:false:displayName]
    const match = serialized.match(/^\$\$\[([^:]+):([^:]+):?([^:]*):?([^:]*):?([^:]*):?([^:]*):?([^\]]*)\]$/);
    
    if (!match) {
      throw new Error(`Invalid object reference: ${serialized}`);
    }

    const [, refType, objectId, fieldId, , , , displayName] = match;

    return {
      type: 'ObjectReference',
      refType: refType,
      objectId: objectId || undefined,
      fieldId: fieldId || undefined,
      displayName: displayName || undefined,
      serialized: serialized
    };
  }

  /**
   * 辅助方法
   */
  _peek() {
    return this.tokens[this.current];
  }

  _advance() {
    const token = this.tokens[this.current];
    this.current++;
    return token;
  }

  _match(type) {
    return this._peek().type === type;
  }

  _isAtEnd() {
    return this._peek().type === TokenType.EOF;
  }
}

module.exports = {
  FormulaParser,
  TokenType
};

