
const options = {
    colors:{
        background:'rgb(45,45,45)',
        varname:'rgb(200,150,255)',
        keyword:'rgb(50,200,255',
        number:'rgb(255,80,80)',
        operator:'rgb(255,255,255)',
    },
    fontSize:20,
}

const TkResult = {
    False:0,
    OutOfBounds:1,
    True:2,
}

class TokenReader{
    constructor(code, index){
        this.code = code;
        this.index = index;
    }
}

class TkRange{
    constructor(min, max){
        this.min = min;
        this.max = max;
    }

    IsValid(t){
        if(t.index>=t.code.length){
            return TkResult.OutOfBounds;
        }
        if(t.code[t.index]>=this.min && t.code[t.index]<=this.max){
            t.index++;
            return TkResult.True;
        }
        return TkResult.False;
    }
}

class TkChar{
    constructor(char){
        this.char = char;
    }

    IsValid(t){
        if(t.index>=t.code.length){
            return TkResult.OutOfBounds;
        }
        if(t.code[t.index]==this.char){
            t.index++;
            return TkResult.True;
        }
        return TkResult.False;
    }
}

class TkOr{
    constructor(branches){
        this.branches = branches;
    }

    IsValid(t){
        var index = t.index;
        for(var b of this.branches){
            t.index = index;
            var result = b.IsValid(t);
            if(result!=TkResult.False){
                return result;
            }
        }
        return TkResult.False;
    }
}

class TkWhile{
    constructor(element, minLength){
        this.element = element;
        this.minLength = minLength;
    }

    IsValid(t){
        var start = t.index;
        while(true){
            var result = this.element.IsValid(t);
            if(result==TkResult.OutOfBounds){
                return TkResult.OutOfBounds;
            }
            if(result == TkResult.False){
                return t.index - start >= this.minLength ? TkResult.True: TkResult.False;
            }
        }
    }
}

class TkAnd{
    constructor(elements){
        this.elements = elements;
    }

    IsValid(t){
        for(var e of this.elements){
            var result = e.IsValid(t);
            if(result != TkResult.True){
                return result;
            }
        }
        return TkResult.True;
    }
}

function TextIsValid(text, tokenizer){
    var t = new TokenReader(text, 0);
    return tokenizer.IsValid(t)!=TkResult.False && t.index==text.length;
}

class TextEditor{
    constructor(text, cursor, tokenizer){
        this.text = text;
        this.cursor = cursor;
        this.tokenizer = tokenizer;
    }

    Insert(text){
        var newText = this.text.substring(0, this.cursor) + text + this.text.substring(this.cursor);
        if(TextIsValid(newText, this.tokenizer)){
            this.text = newText;
            this.cursor+=text.length;
            return true;
        }
        return false;
    }

    Backspace(){
        if(this.cursor>0){
            var newText = this.text.substring(0, this.cursor-1) + this.text.substring(this.cursor);
            if(TextIsValid(newText, this.tokenizer)){
                this.text = newText;
                this.cursor--;
                return true;
            }
        }
        return false;
    }

    KeyDown(e){
        if(!e.key){
            return;
        }
        if(e.key == 'Backspace'){
            if(this.Backspace()){
                e.key = undefined;
            }
        }
        else if(e.key.length == 1){
            if(this.Insert(e.key)){
                e.key = undefined;
            }
        }
    }

    Draw(astEditor, fillStyle, active){
        var ctx = astEditor.ctx;
        ctx.fillStyle = fillStyle;
        ctx.fillText(this.text, astEditor.x, astEditor.y);
        if(active){
            var cursorX = ctx.measureText(this.text.substring(0, this.cursor)).width;
            ctx.fillStyle = 'white';
            ctx.fillRect(astEditor.x+cursorX, astEditor.y-options.fontSize, 2, options.fontSize);
        }
        astEditor.x+=ctx.measureText(this.text).width;
    }
}

class Literal{
    constructor(literal, fillStyle){
        this.literal = literal;
        this.fillStyle = fillStyle;
    }

    Draw(astEditor){
        var ctx = astEditor.ctx;
        ctx.fillStyle = this.fillStyle;
        ctx.fillText(this.literal, astEditor.x, astEditor.y);
        astEditor.x+=ctx.measureText(this.literal).width+astEditor.spaceLength;
    }

    GetTokenizer(){
        return new TkAnd(Array.from(this.literal).map(c=>new TkChar(c)))
    }

    IsBranch(text){
        return text == this.literal;
    }
}

class Input{
    constructor(tokenizer, fillStyle){
        this.tokenizer = tokenizer;
        this.fillStyle = fillStyle;
    }

    SetParseParent(parseParent){
        this.parseParent = parseParent;
    }

    Construct(){
        return new TextEditor('', 0, this.tokenizer);
    }

    KeyDown(tree, e){
        tree.KeyDown(e);
    }

    Draw(astEditor, tree, active){
        tree.Draw(astEditor, this.fillStyle, active);        
    }

    GetTokenizer(){
        return this.tokenizer;
    }
}

class Operator{
    constructor(operator, fillStyle){
        this.operator = operator;
        this.fillStyle = fillStyle;
        this.type = operator;
    }

    SetParseParent(parseParent){
        this.parseParent = parseParent;
    }

    Construct(parent){
        return {parent, type:this.operator}
    }

    Draw(astEditor){
        var ctx = astEditor.ctx;
        ctx.fillStyle = this.fillStyle;
        astEditor.x+=astEditor.spaceLength;
        ctx.fillText(this.operator, astEditor.x, astEditor.y);
        astEditor.x+=ctx.measureText('=').width+astEditor.spaceLength;
    }

    KeyDown(tree, e){
    }

    GetTokenizer(){
        return new TkAnd(Array.from(this.operator).map(c=>new TkChar(c)))
    }

    IsBranch(text){
        return text == this.operator;
    }
}

class Field{
    constructor(name, value){
        this.name = name;
        this.value = value;
    }

    GetTokenizer(){
        return this.value.GetTokenizer();
    }
}

class Obj{
    constructor(type, parsers){
        this.type = type;
        this.parsers = parsers;
        var fields = this.parsers.filter(f=>f.constructor.name=='Field');
        for(var i=0;i<fields.length;i++){
            fields[i].id = i;
        }
        this.fieldCount = fields.length;
    }

    SetParseParent(parseParent){
        this.parseParent = parseParent;
        for(var p of this.parsers){
            if(p.constructor.name == 'Field'){
                p.value.SetParseParent(this);
            }
        }
    }

    KeyDown(tree, e){
        for(var f of this.parsers){
            if(f.constructor.name == 'Field' && tree.selected == f.id){
                f.value.KeyDown(tree['_'+f.name], e);
            }
        }
        if((e.key == ' ' || e.key=='Tab' || e.key == 'Enter')){
            if(tree.selected<this.fieldCount){
                tree.selected++;
                if(tree.selected<this.fieldCount){
                    e.key = undefined;
                }
            }
        }
    }

    Construct(parent){
        var result = {type:this.type, parent, selected:0};
        for(var f of this.parsers){
            if(f.constructor.name == 'Field'){
                result['_'+f.name] = f.value.Construct();
            }
        }
        return result;
    }

    Draw(astEditor, tree, active){
        for(var f of this.parsers){
            if(f.constructor.name == 'Field'){
                f.value.Draw(astEditor, tree['_'+f.name], active && tree.selected == f.id);
            }
            else{
                f.Draw(astEditor);
            }
        }
    }

    IsBranch(text){
        return this.parsers[0].IsBranch(text);
    }

    GetTokenizer(){
        return this.parsers[0].GetTokenizer();
    }
}

class Or{
    constructor(branches){
        this.branches = branches;
        this.tokenizer = new TkOr(branches.map(b=>b.GetTokenizer()));
    }

    SetParseParent(parseParent){
        this.parseParent = parseParent;
        for(var b of this.branches){
            b.SetParseParent(this);
        }
    }

    Construct(parent){
        return  {parent, type:'Unknown', textEditor:new TextEditor('', 0, this.tokenizer)};
    }

    KeyDown(tree, e){
        if(tree.type == 'Unknown'){
            if(e.key == ' ' || e.key == 'Tab' || e.key == 'Enter'){
                var branch = this.branches.find(b=>b.IsBranch(tree.textEditor.text));
                if(branch){
                    this.parseParent.Replace(tree, branch.Construct(tree.parent));
                }
                e.key = undefined;
            }
            else{
                tree.textEditor.KeyDown(e);
            }
        }
        else{
            var branch = this.branches.find(b=>b.type == tree.type);
            branch.KeyDown(tree, e);
        }
    }

    Draw(astEditor, tree, active){
        if(tree.type == 'Unknown'){
            tree.textEditor.Draw(astEditor, options.colors.keyword, active);
        }
        else{
            var branch = this.branches.find(b=>b.type == tree.type);
            branch.Draw(astEditor, tree, active);
        }
    }
}

class Expression{
    constructor(element, operator){
        this.element = element;
        this.operator = operator;
    }

    Replace(old, _new){
        var index = old.parent.tree.indexOf(old);
        if(index>=0){
            old.parent.tree[index] = _new;
        }
        else{
            throw 'Replace: Cant find old.';
        }
    }

    SetParseParent(parseParent){
        this.parseParent = parseParent;
        this.element.SetParseParent(this);
        this.operator.SetParseParent(this);
    }

    Construct(parent){
        var result = {parent, selected:0, tree:[]};
        this.element.Construct(parent);
        result.tree.push(this.element.Construct(result));
        return result;
    }

    KeyDown(tree, e){
        if(tree.selected%2==0){
            this.element.KeyDown(tree.tree[tree.selected], e);
            if(e.key == ' ' || e.key == 'Tab'){
                tree.tree.push(this.operator.Construct(tree));
                tree.selected++;
                e.key = undefined;
            }
        }
        else{
            this.operator.KeyDown(tree.tree[tree.selected], e);
            if(e.key == ' ' || e.key == 'Tab'){
                tree.tree.push(this.element.Construct(tree));
                tree.selected++;
                e.key = undefined;
            }
        }
        
    }

    Draw(astEditor, tree, active){
        for(var i=0;i<tree.tree.length;i+=2){
            this.element.Draw(astEditor, tree.tree[i], active && tree.selected == i);
            if(i+1 < tree.tree.length){
                this.operator.Draw(astEditor, tree.tree[i+1], active && tree.selected == i+1);
            }
        }
    }

    GetTokenizer(){
        return this.element.GetTokenizer();
    }
}


class Multiple{
    constructor(element){
        this.element = element;
    }

    Replace(old, _new){
        var index = old.parent.tree.indexOf(old);
        if(index>=0){
            old.parent.tree[index] = _new;
        }
        else{
            throw 'Replace: Cant find old.';
        }
    }

    SetParseParent(parseParent){
        this.parseParent = parseParent;
        this.element.SetParseParent(this);
    }

    Construct(parent){
        var result = {parent, selected:0, tree:[]};
        this.element.Construct(parent);
        result.tree.push(this.element.Construct(result));
        return result;
    }

    KeyDown(tree, e){
        this.element.KeyDown(tree.tree[tree.selected], e);
        if(e.key == ' ' || e.key == 'Tab' || e.key == 'Enter'){
            tree.tree.push(this.element.Construct(tree));
            tree.selected++;
            e.key = undefined;
        }
    }

    Draw(astEditor, tree, active){
        for(var i=0;i<tree.tree.length;i++){
            this.element.Draw(astEditor, tree.tree[i], active && tree.selected == i);
            astEditor.NewLine();
        }
    }

    GetTokenizer(){
        return this.element.GetTokenizer();
    }
}

function CreateCanvas(){
    var canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    canvas.width = 800;
    canvas.height = 600;
    return canvas.getContext('2d');
}

class ASTEditor{
    constructor(parseTree){
        this.parseTree = parseTree;
        this.parseTree.SetParseParent(this);
        this.ctx = CreateCanvas();
        this.tree = parseTree.Construct(this);
        this.Draw();
    }

    NewLine(){
        this.x = 0;
        this.y+=this.lineSize;
    }
    
    Draw(){
        this.ctx.fillStyle = options.colors.background;
        this.ctx.fillRect(0,0,this.ctx.canvas.width,this.ctx.canvas.height);

        this.fontSize = 20;
        this.ctx.font = options.fontSize+'px Arial';
        this.lineSize = options.fontSize*1.5;
        this.spaceLength = this.ctx.measureText(' ').width;
        this.x = 0;
        this.y = this.fontSize;

        this.parseTree.Draw(this, this.tree, true);
        this.x=0;
        this.y+=this.lineSize;
    }

    KeyDown(e){
        this.parseTree.KeyDown(this.tree, {key:e.key});
        this.Draw();
        e.preventDefault(); 
    }
}

var digit = new TkRange('0', '9');
var character = new TkOr([new TkRange('a', 'z'), new TkRange('A', 'Z'), new TkRange('_')]);
var dot = new TkChar('.');
var float = new TkAnd([new TkWhile(digit, 1), dot, new TkWhile(digit, 0)]);
var int = new TkWhile(digit, 1);
var varname = new TkAnd([character, new TkWhile(new TkOr([character, digit], 0))]);

var number = new Input(new TkOr([float, int]), options.colors.number);
var _name = new Input(varname, options.colors.varname);
var operators = new Or([new Operator('+', options.colors.operator), new Operator('-', options.colors.operator)]);
var expression = new Expression(number, operators);

var _var = new Obj('var', [
    new Literal('var', options.colors.keyword), 
    new Field('name', _name),
    new Operator('=', options.colors.operator), 
    new Field('expression', expression)]);

var _return = new Obj('return', [
    new Literal('return', options.colors.keyword), 
    new Field('expression', expression)
]);

var statements = new Multiple(new Or([_var, _return]));
var astEditor = new ASTEditor(statements);
addEventListener('keydown', e=>astEditor.KeyDown(e));