
const options = {
    colors:{
        background:'rgb(45,45,45)',
        varname:'rgb(200,150,255)',
        keyword:'rgb(50,200,255',
        operator:'rgb(255,255,255)',
    },
    fontSize:20,
}

class TextEditor{
    constructor(text, cursor){
        this.text = text;
        this.cursor = cursor;
    }

    Insert(text){
        this.text = this.text.substring(0, this.cursor) + text + this.text.substring(this.cursor);
        this.cursor+=text.length;
    }

    Backspace(){
        if(this.cursor>0){
            this.text = this.text.substring(0, this.cursor-1) + this.text.substring(this.cursor);
            this.cursor--;
        }
    }

    KeyDown(e){
        if(!e.key){
            return;
        }
        if(e.key == 'Backspace'){
            this.Backspace();
            e.key = undefined;
        }
        else if(e.key.length == 1 && e.key!=' '){
            this.Insert(e.key);
            e.key = undefined;
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
}

class Varname{
    constructor(fillStyle){
        this.fillStyle = fillStyle;
    }

    SetParseParent(parseParent){
        this.parseParent = parseParent;
    }

    Construct(){
        return new TextEditor('', 0)
    }

    KeyDown(tree, e){
        tree.KeyDown(e);
    }

    Draw(tree, astEditor, active){
        tree.Draw(astEditor, this.fillStyle, active);        
    }
}

class Punctuation{
    constructor(punctuation, fillStyle){
        this.punctuation = punctuation;
        this.fillStyle = fillStyle;
    }

    Draw(astEditor){
        var ctx = astEditor.ctx;
        ctx.fillStyle = this.fillStyle;
        astEditor.x+=astEditor.spaceLength;
        ctx.fillText('=', astEditor.x, astEditor.y);
        astEditor.x+=ctx.measureText('=').width+astEditor.spaceLength;
    }
}

class Field{
    constructor(name, value){
        this.name = name;
        this.value = value;
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

    Draw(tree, astEditor, active){
        for(var f of this.parsers){
            if(f.constructor.name == 'Field'){
                f.value.Draw(tree['_'+f.name], astEditor, active && tree.selected == f.id);
            }
            else{
                f.Draw(astEditor);
            }
        }
    }

    IsBranch(text){
        if(this.parsers[0].constructor.name == 'Literal' && this.parsers[0].literal == text){
            return true;
        }
        return false;
    }
}

class Or{
    constructor(branches){
        this.branches = branches;
    }

    SetParseParent(parseParent){
        this.parseParent = parseParent;
        for(var b of this.branches){
            b.SetParseParent(this);
        }
    }

    Construct(parent){
        return  {parent, type:'Unknown', textEditor:new TextEditor('', 0)};
    }

    KeyDown(tree, e){
        if(tree.type == 'Unknown'){
            if(e.key == ' ' || e.key == 'Tab' || e.key == 'Enter'){
                var branch = this.branches.find(b=>b.IsBranch(tree.textEditor.text));
                if(branch){
                    this.parseParent.Replace(tree,branch.Construct(tree.parent));
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

    Draw(tree, astEditor, active){
        if(tree.type == 'Unknown'){
            tree.textEditor.Draw(astEditor, options.colors.keyword, active);
        }
        else{
            var branch = this.branches.find(b=>b.type == tree.type);
            branch.Draw(tree, astEditor, active);
        }
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

    Draw(tree, astEditor, active){
        for(var i=0;i<tree.tree.length;i++){
            this.element.Draw(tree.tree[i], astEditor, active && tree.selected == i);
            astEditor.NewLine();
        }
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

        this.parseTree.Draw(this.tree, this, true);
        this.x=0;
        this.y+=this.lineSize;
    }

    KeyDown(e){
        this.parseTree.KeyDown(this.tree, {key:e.key});
        this.Draw();
        e.preventDefault(); 
    }
}

var _var = new Obj('var', [
    new Literal('var', options.colors.keyword), 
    new Field('name', new Varname(options.colors.varname)),
    new Punctuation('=', options.colors.operator), 
    new Field('expression', new Varname(options.colors.varname))]);

var _return = new Obj('return', [
    new Literal('return', options.colors.keyword), 
    new Field('expression', new Varname(options.colors.varname))
]);

var statements = new Multiple(new Or([_var, _return]));
var astEditor = new ASTEditor(statements);
addEventListener('keydown', e=>astEditor.KeyDown(e));