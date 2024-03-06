var code = `
Test{ 3 }
X { Test + 2 }
Test + X
`; 

function Tokenizer(code){
    function CreateLastToken(){
        if(split==false){
            tokens.push(code.substring(start, i));
        }
        split=true;
    }

    const operators = '{}+-*/()';
    const whitespace = ' \t\n\r';
    var tokens = [];
    var split = true;
    var start = 0;
    for(var i=0;i<code.length;i++){
        var c = code[i];
        if(whitespace.includes(c)){
            CreateLastToken();
        }
        else if(operators.includes(c)){
            CreateLastToken();
            tokens.push(c);
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

class Func{
    constructor(_export, name, parameters, body){
        this.isFunc = true;
        this.export = _export;
        this.name = name;
        this.parameters = parameters;
        this.body = body;
    }
}

class Expression{
    constructor(tokens){
        this.isExpression = true;
        this.tokens = tokens;
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
                var open = braces.find(b=>b[0] == tokens[i]);
                var close = braces.find(b=>b[1] == tokens[i]);
                if(open){
                    i++;
                    result.push({braces:open, value:ParseBraces(open)});
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
            if(typeof tokens[i] == 'object' && tokens[i].braces == '{}'){
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

    function ParseTree(groupedTokens){
        var tree = [];
        for(var i=0;i<groupedTokens.length;i++){
            var group = groupedTokens[i];
            var lastGroup = group[group.length-1];
            if(typeof(lastGroup) == 'object' && lastGroup.braces == '{}'){
                var _export = false;
                var parameters;
                var name;
                var ii = 0;
                if(typeof(group[ii]) == 'string' && group[ii] == 'export'){
                    _export = true;
                    ii++;
                }
                if(typeof(group[ii]) == 'string'){
                    name = group[ii];
                    ii++;
                }
                if(typeof(group[ii]) == 'object' && group[ii].braces == '()'){
                    parameters = group[ii].value;
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
var wasmFuncs = [];


var importObject = {env:{}};
importObject.env.memory = new WebAssembly.Memory({ initial: 10, maximum: 10 });

var wasmBytes = Wasm([
    WasmFunc(true, [Valtype.i32], 'Main', [Valtype.i32], [], [
        Opcode.get_local, ...signedLEB128(0), Opcode.get_local, ...signedLEB128(0), Opcode.i32_mul, Opcode.end
    ])
]);
WebAssembly.instantiate(wasmBytes, importObject).then(
    (obj) => {
        console.log(obj.instance.exports.Main(10));
    }
);