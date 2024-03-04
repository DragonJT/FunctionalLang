const fillStyles = {
    operator:'rgb(100,255,100)',
    varname:'rgb(50,200,255)',
}

function CreateCanvas(){
    var canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    canvas.width = 800;
    canvas.height = 600;
    return canvas.getContext('2d');
}

class Token{
    constructor(code, type){
        this.code = code;
        this.type = type;
    }

    Draw(codeEditor, parent){
        if(this.type == 'whitespace'){
            for(var i=0;i<this.code.length;i++){
                if(this.code[i] == ' '){
                    codeEditor.SetCursorIfEqualToIndex(parent);
                    codeEditor.x+=codeEditor.space;
                }
                else if(this.code[i] == '\t'){
                    codeEditor.SetCursorIfEqualToIndex(parent);
                    codeEditor.x+=codeEditor.space*4;
                }
                else if(this.code[i] == '\n'){
                    codeEditor.SetCursorIfEqualToIndex(parent);
                    codeEditor.x=0;
                    codeEditor.y+=codeEditor.lineSize;
                }
                codeEditor.index++;
            }
            codeEditor.SetCursorIfEqualToIndex(parent);
        }
        else{
            var ctx = codeEditor.ctx;
            var deltaIndex = codeEditor.cursor - codeEditor.index;
            if(deltaIndex >= 0 && deltaIndex <= this.code.length){
                var cursorDeltaX = ctx.measureText(this.code.substring(0, deltaIndex)).width;
                codeEditor.cursorX = codeEditor.x+cursorDeltaX;
                codeEditor.cursorY = codeEditor.y;
                codeEditor.cursorParent = parent;
            }
            ctx.fillStyle = fillStyles[this.type];
            ctx.fillText(this.code, codeEditor.x, codeEditor.y+codeEditor.fontSize);
            codeEditor.x+=ctx.measureText(this.code).width;
            codeEditor.index+=this.code.length;
        }
   }
}

function Tokenize(code){
    const operators = '+-/*=';
    const whitespace = ' \t\r\n';
    var tokens = [];

    var lastTokenType;
    var lastTokenStart = 0;

    function SetCurrentTokenType(newTokenType){
        if(lastTokenType != newTokenType){
            if(i>lastTokenStart){
                tokens.push(new Token(code.substring(lastTokenStart, i), lastTokenType));
            }
            lastTokenType = newTokenType;
            lastTokenStart = i;
        }
    }

    for(var i=0;i<code.length;i++){
        var c = code[i];
        if(whitespace.includes(c)){
            SetCurrentTokenType('whitespace');
        }
        else if(operators.includes(c)){
            SetCurrentTokenType('operator');
        }
        else{
            SetCurrentTokenType('varname');
        }
    }
    if(i>lastTokenStart){
        tokens.push(new Token(code.substring(lastTokenStart, i), lastTokenType));
    }
    return tokens;
}

class CodeEditor{
    constructor(){
        this.ctx = CreateCanvas();
        this.cursor = 0;
    }

    SetCode(code){
        this.tokens = Tokenize(code);
    }

    SetCursorIfEqualToIndex(parent){
        if(this.index == this.cursor){
            this.cursorX = codeEditor.x;
            this.cursorY = codeEditor.y;
            this.cursorParent = parent;
        }
    }

    Draw(){
        this.ctx.fillStyle = 'rgb(40,40,40)';
        this.ctx.fillRect(0,0,this.ctx.canvas.width, this.ctx.canvas.height);
        this.x = 0;
        this.y = 0;
        this.index = 0;
        this.fontSize = 20;
        this.ctx.font = this.fontSize+'px Arial';
        this.lineSize = this.fontSize*1.5;
        this.space = this.ctx.measureText(' ').width;
        this.startIndex = 0;
        this.cursorX = this.x;
        this.cursorY = this.y;

        for(var token of this.tokens){
            token.Draw(this, this);
        }

        if(this.cursor>this.index){
            this.cursor = this.index;
            this.cursorX = this.x;
            this.cursorY = this.y;
        }
        this.ctx.fillStyle = 'rgb(255,255,255)';
        this.ctx.fillRect(this.cursorX, this.cursorY, 2, this.fontSize);
    }

    Insert(c){
        var code = '';
        for(var token of this.cursorParent.tokens){
            code+=token.code;
        }
        var index = this.cursor-this.startIndex;
        code = code.substring(0, index) + c + code.substring(index);
        this.cursor+=c.length;
        this.cursorParent.tokens = Tokenize(code);
    }   

    Backspace(){
        var index = this.cursor-this.startIndex;
        if(index>0){
            var code = '';
            for(var token of this.cursorParent.tokens){
                code+=token.code;
            }
            code = code.substring(0, index-1) + code.substring(index);
            this.cursor--;
            this.cursorParent.tokens = Tokenize(code);
        }
    }

    KeyDown(e){
        if(e.key == 'ArrowLeft'){
            this.cursor--;
            if(this.cursor<0){
                this.cursor=0;
            }
        }
        else if(e.key == 'ArrowRight'){
            this.cursor++;
        }
        else if(e.key == 'Enter'){
            this.Insert('\n');
        }
        else if(e.key == 'Tab'){
            this.Insert('\t');
        }
        else if(e.key == 'Backspace'){
            this.Backspace();
        }
        else if(e.key.length == 1){
            this.Insert(e.key);
        }
        this.Draw();
        e.preventDefault();
    }
}

var codeEditor = new CodeEditor();
codeEditor.SetCode('var x = test + 55')
codeEditor.Draw();
addEventListener('keydown', e=>codeEditor.KeyDown(e));