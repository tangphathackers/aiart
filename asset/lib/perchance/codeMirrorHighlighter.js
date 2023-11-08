// for playing about and testing: http://jsfiddle.net/TcqAf/529/

// newer version: http://jsbin.com/filalidobe/1/edit?html,output
// problem is, even if I do work out this: https://stackoverflow.com/questions/52160551/way-to-overlay-multiple-tokens-rules-with-codemirror-simple-mode
//   i'll still have to sort out this [a = [], "hello"] - probably need to write a proper mode (using same logic that breaks up square blocks)

CodeMirror.defineSimpleMode("simplemode", {
  // The start state contains the rules that are intially used
  start: [
      // You can embed other modes with the mode property. This rule
    // causes all code between << and >> to be highlighted with the XML
    // mode.
//    {regex: /(?:^|[^\\])(?:\\\\)*(\[)/, token: "variable-3", mode: {spec: "javascript", end: /(?:^|[^\\])(?:\\\\)*(\])/}},
    // The regex matches the token, the token property contains the type
    //{regex: /"(?:[^\\]|\\.)*?(?:"|$)/, token: "string"},
    // You can match multiple tokens at once. Note that the captured
    // groups must span the whole string in this case
    {regex: /([a-zA-Z][a-zA-Z0-9$_]+)(\s*)(\()([^)]*)(\))(\s*)(=>)/,
     token: ["variable-2", null, "keyword", null, "keyword", null, "keyword"]},

    // curly
    {regex: /\{[a-zA-Z]-[a-zA-Z]\}/, token: "syntax-style1"},
    {regex: /\{[0-9]+-[0-9]+\}/, token: "syntax-style1"},
    {regex: /\{/, token: "syntax-style1"},
    {regex: /\}/, token: "syntax-style1"},

    // square
    //{regex: /\[[^\]]+\]/, token: "variable-3"},
    {regex: /\[/, token: "syntax-style2"},
    {regex: /\]/, token: "syntax-style2"},

    // equals
    {regex: /=/, token: "keyword"},

    // not sure
    {regex: /\$output\b/, token: "variable-2"},
    {regex: /\$preprocess\b/, token: "variable-2"},
    
    //{regex: /true|false|null|undefined/, token: "atom"},
    //{regex: /0x[a-f\d]+|[-+]?(?:\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/i,
     //token: "number"},
    {regex: /[\s](\/\/.*)/, token: "syntax-style3-comment"},
    {regex: /(\/\/.*)/, token: "syntax-style3-comment", sol:true},
    //{regex: /\/(?:[^\\]|\\.)*?\//, token: "variable-3"},
    //{regex: /[-+\/*=<>!]+/, token: "operator"},
    // indent and dedent properties guide autoindentation
    //{regex: /=>/, indent: true},
    //{regex: /[\}\]\)]/, dedent: true},
    //{regex: /[a-z$][\w$]*/, token: "variable"},
  ],
  // The meta property contains global information about the mode. It
  // can contain properties like lineComment, which are supported by
  // all modes, and also directives like dontIndentStates, which are
  // specific to simple modes.
  meta: {
    dontIndentStates: ["comment"],
    lineComment: "//",
    fold: "indent",
  }
});


// CodeMirror.defineMode("mustache", function(config, parserConfig) {
//   var mustacheOverlay = {
//     token: function(stream, state) {
//       var ch;
//       if (stream.match("{")) {
//         while ((ch = stream.next()) != null)
//           if (stream.next() == "}") {
//             stream.eat("}");
//             return "variable-2";
//           }
//       }
//       while (stream.next() != null && !stream.match("{", false)) {}
//       return null;
//     }
//   };
//   return CodeMirror.overlayMode(CodeMirror.getMode(config, parserConfig.backdrop || "text/html"), mustacheOverlay);
// });

try {

  CodeMirror.defineMode("perchancelists", function(config) {

    var jsMode = CodeMirror.getMode(config, "javascript");
  
    // this, in a sense, `trimStart`s the stream and then gets the next two characters
    function skipSpacesAndPeekTwo(stream) {
      let count = 0;
      let result = '';
      for (let i = stream.pos; i < stream.string.length; i++) {
        let char = stream.string.charAt(i);
        if (char !== ' ' && char !== '\t') {
          result += char;
          count++;
          if (count === 2) {
            return result;
          }
        }
      }
      return null;
    }
    
    function token(stream, state) {    
      if(state.inSquareBlock && state.inFunction) console.error("invalid state - cannot be both in function and square block at same time");
      if(stream.string.length > 50000) { // Consume the entire line if it's too long
        stream.skipToEnd();
        return null;  // No styling applied
      }
  
      if(stream.sol() && state.inSquareBlock) { // square blocks cannot span multiple lines
        state.bracketDepth = 0;
        state.inSquareBlock = false;
        state.localState = null;
        return null;
      }
  
      if(stream.sol() && state.inFunction && stream.indentation() <= state.functionIndent && skipSpacesAndPeekTwo(stream) !== "//") {
        state.inFunction = false;
        state.localState = null;
        stream.backUp(stream.current().length); // rewind to the beginning of the line (important)
        return null;
      }
    
      if(state.inSquareBlock || state.inFunction) {
        let style = jsMode.token(stream, state.localState);
        let current = stream.current();
    
        if(state.inFunction) {
          if(state.inSquareBlock) console.error("inSquareBlock while also inFunction");
          // note: we already early-exited in case of indentation-based function end, above, so we know we're still in the function here
          return style;
        } else if(state.inSquareBlock) {
          if(state.inFunction) console.error("inFunction while also inSquareBlock");
  
          // don't count square brackets that are in strings, regex, or comments:
          if(style !== "string" && style !== "string-2" && style !== "comment") {
            if(current === "]") {
              state.bracketDepth--;
              if (state.bracketDepth <= 0) {
                state.inSquareBlock = false;
                state.localState = null;
                return "square-bracket";
              }
            }
            if(current === "[") {
              state.bracketDepth++;
            }
            if(state.bracketDepth <= 0) {
              state.inSquareBlock = false;
              state.localState = null;
            }
          }
          
          return style;
        }
      } else {
        if(stream.sol() && stream.match(/\/\/.*/)) {
          return "comment";
        } else if (stream.match(/\s\/\/.*/)) {
          return "comment";
        }
        if(stream.peek() === "[") {
          state.bracketDepth = 1;
          state.inSquareBlock = true;
          state.localState = CodeMirror.startState(jsMode);
          stream.next();
          return "square-bracket";
        }
    
        // if(stream.match(/^\w*(?=\()/)) {
        //   return "def";
        // }
    
        if(stream.match(/^[a-zA-Z0-9$_]+\([^\)]*\) => */)) {
          state.localState = CodeMirror.startState(jsMode);
          state.inFunction = true;
          state.functionIndent = stream.indentation();
          return "def";
        }
    
        if(stream.match('\\[') || stream.match('\\]')) {
          return "escaped-char";
        }
        if(stream.match('{') || stream.match('}')) {
          return "curly-bracket";
        }
        if(stream.match(/\$output\b/) || stream.match(/\$preprocess\b/)) {
          return "special-list-name";
        }
        stream.next();
        return null;
      }
    }
    
    return {
      startState: function() {
        return {
          inSquareBlock: false,
          localState: null,
          bracketDepth: 0,
          inFunction: false,
          functionIndent: 0,
        };
      },
      token: token,
      lineComment: "//",
      fold: "indent",
    };
  });

  // let systemIsInDarkMode = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  // window.codeMirrorModelTextEditor = CodeMirror.fromTextArea(document.body.querySelector("#input"), {
  //   lineNumbers: true,
  //   foldGutter: true,
  //   extraKeys: {
  //     //"Ctrl-Q": cm => cm.foldCode(cm.getCursor()),
  //     //"Ctrl-Y": cm => CodeMirror.commands.foldAll(cm),
  //     //"Ctrl-I": cm => CodeMirror.commands.unfoldAll(cm),
  //   },
  //   gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
  //   tabSize: 2,
  //   indentUnit: 2,
  //   indentWithTabs: false,
  //   matchBrackets: true,
  //   mode: "perchancelists",
  //   styleActiveLine: true,
  //   // mode: "text",
  //   lineWrapping:false,
  //   theme: systemIsInDarkMode ? "one-dark" : "one-light",
  //   keyMap: "sublime",
  // });
  // window.codeMirrorModelTextEditor.setOption("mode", "perchancelists");





  // OLD:
  // CodeMirror.defineMode("perchancelists", function(config) {

  //   var jsMode = CodeMirror.getMode(config, "javascript");

  //   function token(stream, state) {    
  //     if(state.inSquareBlock && state.inFunction) console.error("invalid state - cannot be both in function and square block at same time");
  //     if(stream.string.length > 50000) { // Consume the entire line if it's too long
  //       stream.skipToEnd();
  //       return null;  // No styling applied
  //     }

  //     if(state.inSquareBlock || state.inFunction) {
  //       var style = jsMode.token(stream, state.localState);
  //       if (style === "string" || style === "string-2" || style === "comment") {
  //         return style;
  //       }
  //       var current = stream.current();

  //       if(state.inFunction) {
  //         if(state.inSquareBlock) console.error("inSquareBlock while also inFunction");
          
  //         if(stream.indentation() <= state.functionIndent) {
  //           state.localState = null;
  //           state.inFunction = false;
  //           stream.backUp(stream.current().length); // Rewind to the beginning of the line (important)
  //           return null;
  //         }
  //       } else if(state.inSquareBlock) {
  //         if(state.inFunction) console.error("inFunction while also inSquareBlock");
    
  //         if (current === "]") { // note: this square bracket is not inside a string/regex, since we early-returned above in those cases
  //           state.bracketDepth--;
  //           if (state.bracketDepth <= 0) {
  //             state.inSquareBlock = false;
  //             state.localState = null;
  //             return "square-bracket";
  //           }
  //         }
    
  //         if(current === "[") {
  //           state.bracketDepth++;
  //         }

  //         if(state.bracketDepth <= 0) {
  //           state.inSquareBlock = false;
  //           state.localState = null;
  //         }
  //       }

  //       return style;
  //     } else {
  //       if(stream.match(/\$output\b/) || stream.match(/\$preprocess\b/)) {
  //         return "special-list-name";
  //       }
  //       if(stream.sol() && stream.match(/\/\/.*/)) {
  //         return "comment";
  //       } else if (stream.match(/\s\/\/.*/)) {
  //         return "comment";
  //       }
  //       if(stream.peek() === "[") {
  //         state.bracketDepth = 1;
  //         state.inSquareBlock = true;
  //         state.localState = CodeMirror.startState(jsMode);
  //         stream.next();
  //         return "square-bracket";
  //       }

  //       if(stream.match(/^[a-zA-Z0-9$_]\w*(?=\()/)) {
  //         return "def";
  //       }

  //       if(stream.match(/\([^\)]*\) =>/)) {
  //         state.localState = CodeMirror.startState(jsMode);
  //         state.inFunction = true;
  //         state.functionIndent = stream.indentation();
  //         return "javascript";
  //       }

  //       if(stream.match('\\[') || stream.match('\\]')) {
  //         return "escaped-char";
  //       }
  //       if(stream.match('{') || stream.match('}')) {
  //         return "curly-bracket";
  //       }
  //       stream.next();
  //       return null;
  //     }
  //   }

  //   return {
  //     startState: function() {
  //       return {
  //         inSquareBlock: false,
  //         localState: null,
  //         bracketDepth: 0,
  //         inFunction: false,
  //         functionIndent: 0,
  //       };
  //     },
  //     token: token,
  //     lineComment: "//",
  //     fold: "indent",
  //   };
  // });

} catch(e) { console.error(e); }