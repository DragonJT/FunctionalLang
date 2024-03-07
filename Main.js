var code = `
factorial(n) { n < 2 ? 1 : factorial(n - 1) * n }
factorial(10)
`; 

function Tokenizer(code){
    function IsDigit(c){
        return c>='0' && c<='9';
    }

    function CreateLastToken(){
        if(split==false){
            var value = code.substring(start, i);
            var type = 'varname';
            if(IsDigit(value[0])){
                type = 'int';
                if(value.includes('.')){
                    type = 'float';
                }
            }
            tokens.push({type, start, end:i, code, value});
        }
        split=true;
    }

    const punctuation = '?:{}+-*/(),<>';
    const whitespace = ' \t\n\r';
    var tokens = [];
    var split = true;
    var start = 0;
    for(var i=0;i<code.length;i++){
        var c = code[i];
        if(whitespace.includes(c)){
            CreateLastToken();
        }
        else if(punctuation.includes(c)){
            CreateLastToken();
            tokens.push({type:'punctuation', start:i, end:i+1, code, value:c});
        }
        else{
            if(split){
                split=false;
                start=i;
            }
        }
    }
    CreateLastToken();
    return tokens;
}

function SplitByComma(tokens){
    var start = 0;
    var values = [];
    for(var i=0;i<tokens.length;i++){
        if(tokens[i].type == 'punctuation' && tokens[i].value == ','){
            values.push(tokens.slice(start, i));
            start=i+1;
        }
    }
    var last = tokens.slice(start);
    if(last.length>0){
        values.push(last);
    }
    return values;
}

class Parameter{
    constructor(id, name){
        this.id = id;
        this.name = name;
    }

    ToWasm(){
        return [Opcode.get_local, ...unsignedLEB128(this.id)];
    }
}

class Func{
    constructor(_export, name, parameters, body){
        this.isFunc = true;
        this.export = _export;
        this.name = name;
        this.parameters = parameters;
        this.body = body;
    }

    ToWasm(){
        var last = this.body[this.body.length-1];
        if(last.isExpression){
            var wasmParamters = this.parameters.map(p=>Valtype.f32);
            return WasmFunc(this.export, [Valtype.f32], this.name, wasmParamters, [], last.GetCodeBytes(this.parameters));
        }
        else{
            throw 'Expecting expression as return: '+JSON.stringify(last);
        }
    }
}

class Const{
    constructor(value){
        this.value = value;
    }

    ToWasm(){
        return [Opcode.f32_const, ...ieee754(parseFloat(this.value))];
    }
}

class BinaryOp{
    constructor(left, right, op){
        this.left = left;
        this.right = right;
        this.op = op;
    }

    ToWasm(){
        const operatorsToWasm = {
            '+':'add',
            '-':'sub',
            '/':'div',
            '*':'mul',
            '<':'lt',
            '>':'gt',
        };

        if(this.op == '?'){
            if(this.right.op == ':'){
                return [...this.left.ToWasm(), Opcode.if, Blocktype.f32, 
                    ...this.right.left.ToWasm(), Opcode.else, ...this.right.right.ToWasm(), Opcode.end];
            }
            else{
                throw 'Expecting an else ":" operator';
            }
        }
        if(this.op == ':'){
            return ;
        }
        return [...this.left.ToWasm(), ...this.right.ToWasm(), Opcode['f32_'+operatorsToWasm[this.op]]];
    }
}

class Call{
    constructor(func, args){
        this.func = func;
        this.args = args;
    }

    ToWasm(){
        return [...this.args.map(a=>a.ToWasm()).flat(1), Opcode.call, ...unsignedLEB128(this.func.id)];
    }
}

class Expression{
    constructor(tokens){
        this.isExpression = true;
        this.tokens = tokens;
    }

    GetCodeBytes(parameters){
        
        const operatorGroups = [['?'], [':'], ['<', '>'], ['+', '-'], ['*', '/']];

        function ExpressionTree(tokens){

            function TrySplit(operators){
                for(var i=tokens.length-1;i>=0;i--){
                    var t = tokens[i];
                    if(t.type == 'punctuation' && operators.includes(t.value)){
                        var left = ExpressionTree(tokens.slice(0, i));
                        var right = ExpressionTree(tokens.slice(i+1));
                        return new BinaryOp(left, right, t.value);
                    }
                }
                return undefined;
            }
    
            function GetCall(name, args){
                var func = functions.find(f=>f.name == name);
                if(func){
                    return new Call(func, args);
                }
                else{
                    throw 'Cant find function or paramter: '+name;
                }
            }

            function GetArgs(tokens){
                var argExpressions = SplitByComma(tokens);
                var output = [];
                for(var a of argExpressions){
                    output.push(ExpressionTree(a));
                }
                return output;
            }

            if(tokens.length == 1){
                var t = tokens[0];
                if(t.type == 'int' || t.type == 'float'){
                    return new Const(t.value);
                }
                else if(t.type == 'varname'){
                    var parameter = parameters.find(p=>p.name == t.value);
                    if(parameter){
                        return parameter;
                    }
                    else{
                        return GetCall(t.value, []);
                    }
                }
                else{
                    throw 'Unexpected token: '+JSON.stringify(t);
                }
            }
            else if(tokens.length == 2){
                var t1 = tokens[0];
                var t2 = tokens[1];
                if(t1.type == 'varname' && t2.type == '()'){
                    return GetCall(t1.value, GetArgs(t2.value));
                }
            }
            else{
                for(var operators of operatorGroups){
                    var output = TrySplit(operators);
                    if(output){
                        return output;
                    }
                }
            }
            throw "Unexpected expression:"+JSON.stringify(tokens);
        }
        var tree = ExpressionTree(this.tokens);
        return [...tree.ToWasm(), Opcode.end];
    }
    
}

function Parse(tokens){
    
    function ParseBraces(tokens){
        const braces = ['()', '{}', '[]'];    
        var i = 0;
        function ParseBraces(brace){
            var result = [];
            var start = i;
            for(;i<tokens.length;i++){
                var open = braces.find(b=>b[0] == tokens[i].value);
                var close = braces.find(b=>b[1] == tokens[i].value);
                if(open){
                    i++;
                    result.push({type:open, value:ParseBraces(open)});
                }
                else if(close){
                    if(close == brace){
                        return result;
                    }
                }
                else{
                    result.push(tokens[i]);
                }
            }
            if(start==0){
                return result;
            }
            else{
                throw "Missing closing brace: "+brace+start;
            }
        }
        return ParseBraces(tokens, 0);
    }

    function ParseGroups(tokens){
        var start = 0;
        var groups = [];
        for(var i=0;i<tokens.length;i++){
            if(tokens[i].type == '{}'){
                tokens[i].value = ParseGroups(tokens[i].value);
                groups.push(tokens.slice(start, i+1));
                start = i+1;
            }
        }
        if(start < tokens.length){
            groups.push(tokens.slice(start, tokens.length));
        }
        return groups;
    }
    
    var groupedTokens = ParseGroups(ParseBraces(tokens));

    function ParseParameters(tokens){
        var splitTokens = SplitByComma(tokens);
        var parameters = [];
        var id = 0;
        for(var t of splitTokens){
            if(t.length == 1 && t[0].type == 'varname'){
                parameters.push(new Parameter(id, t[0].value));
                id++;
            }
            else{
                throw 'invalid parameter: '+JSON.stringify(t);
            }
        }
        return parameters;
    }

    function ParseTree(groupedTokens){
        var tree = [];
        for(var i=0;i<groupedTokens.length;i++){
            var group = groupedTokens[i];
            var lastGroup = group[group.length-1];
            if(lastGroup.type == '{}'){
                var _export = false;
                var parameters = [];
                var name;
                var ii = 0;
                if(group[ii].type == 'varname' && group[ii].value == 'export'){
                    _export = true;
                    ii++;
                }
                if(group[ii].type == 'varname'){
                    name = group[ii].value;
                    ii++;
                }
                if(group[ii].type == '()'){
                    parameters = ParseParameters(group[ii].value);
                    ii++;
                }
                if(ii == group.length-1){
                    var body = ParseTree(lastGroup.value);
                    tree.push(new Func(_export, name, parameters, body));
                }
                else{
                    throw 'Too many tokens in function header';
                }
            }
            else{
                tree.push(new Expression(group));
            }
        } 
        return tree;
    }
    return ParseTree(groupedTokens);
}

var tree = Parse(Tokenizer(code));

var functions = [];
function FindFunctions(tree){
    for(var f of tree){
        if(f.isFunc){
            functions.push(f);
            if(f.body){
                FindFunctions(f.body);
            }
        }
    }    
}
FindFunctions(tree);
functions.push(new Func(true, '__Init__', [], [tree[tree.length-1]]));

for(var i=0;i<functions.length;i++){
    functions[i].id = i;
}

wasmFuncs = functions.map(f=>f.ToWasm());
var importObject = {env:{}};
importObject.env.memory = new WebAssembly.Memory({ initial: 10, maximum: 10 });

var wasmBytes = Wasm(wasmFuncs);
WebAssembly.instantiate(wasmBytes, importObject).then(
    (obj) => {
        console.log(obj.instance.exports.__Init__());
    }
);