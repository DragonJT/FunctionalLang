
const options = {
    backgroundColor:'rgb(45,45,45)',
    defaultTextColor:'rgb(100,200,255)',
    varnameColor:'rgb(200,150,255)',
    keywordColor:'rgb(50,200,255',
    operatorColor:'rgb(255,255,255)',
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

    Draw(astEditor, fillStyle, active){
        var ctx = astEditor.ctx;
        ctx.fillStyle = fillStyle;
        ctx.fillText(this.text, astEditor.x, astEditor.y);
        if(active){
            var cursorX = ctx.measureText(this.text.substring(0, this.cursor)).width;
            ctx.fillStyle = 'white';
            ctx.fillRect(astEditor.x+cursorX, astEditor.y, 2, options.fontSize);
        }
        astEditor.x+=ctx.measureText(this.text).width;
    }
}

class Var{
    constructor(parent){
        this.name = new TextEditor('', 0);
        this.expression = new TextEditor('', 0);
        this.parent = parent;
        this.current = 'name';
    }

    KeyDown(key){
        if(key == 'Backspace'){
            this[this.current].Backspace();
        }
        else if(key == 'Enter' && this.current=='expression'){
            this.parent.NewLine();
        }
        else if(key==' ' || key=='=' || key=='Tab' || key == 'Enter'){
            this.current = 'expression';
        }
        else if(key.length == 1){
            this[this.current].Insert(key);
        }
    }

    Draw(){
        var ctx = this.parent.ctx;
        ctx.fillStyle = options.keywordColor;
        ctx.fillText('var', this.parent.x, this.parent.y);
        this.parent.x += ctx.measureText('var').width+this.parent.spaceLength;
        this.name.Draw(this.parent, options.varnameColor, this.current=='name');
        if(this.current == 'expression'){
            ctx.fillStyle = options.operatorColor;
            this.parent.x+=this.parent.spaceLength;
            ctx.fillText('=', this.parent.x, this.parent.y);
            this.parent.x+=ctx.measureText('=').width+this.parent.spaceLength;
            this.expression.Draw(this.parent, options.varnameColor, this.current=='expression');
        }
    }
}

class Unknown{
    constructor(parent){
        this.textEditor = new TextEditor('', 0);
        this.parent = parent;
    }

    KeyDown(key){
        if(key == 'Backspace'){
            this.textEditor.Backspace();
        }
        else if(key == ' ' || key=='Enter' || key=='Tab'){
            if(this.textEditor.text == 'var'){
                this.parent.Replace(this, new Var(this.parent));
            }
        }
        else if(key.length == 1){
            this.textEditor.Insert(key);
        }
    }

    Draw(){
        this.textEditor.Draw(this.parent, options.defaultTextColor, true);
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
    constructor(){
        this.ctx = CreateCanvas();
        this.statements = [new Unknown(this)];
        this.lineCursor = 0;
        this.Draw();
    }

    NewLine(){
        this.lineCursor++;
        this.statements.splice(this.lineCursor, 0, new Unknown(this));
    }

    Replace(oldStatement, newStatement){
        var index = this.statements.indexOf(oldStatement);
        if(index>=0){
            this.statements[index] = newStatement;
        }
    }

    Draw(){
        this.ctx.fillStyle = options.backgroundColor;
        this.ctx.fillRect(0,0,this.ctx.canvas.width,this.ctx.canvas.height);

        
        this.fontSize = 20;
        this.ctx.font = options.fontSize+'px Arial';
        this.lineSize = options.fontSize*1.5;
        this.spaceLength = this.ctx.measureText(' ').width;
        this.x = 0;
        this.y = this.fontSize;

        for(var s of this.statements){
            s.Draw();
            this.x=0;
            this.y+=this.lineSize;
        }
    }

    KeyDown(e){
        this.statements[this.lineCursor].KeyDown(e.key);
        this.Draw();
        e.preventDefault();
    }
}

var astEditor = new ASTEditor();
addEventListener('keydown', e=>astEditor.KeyDown(e));