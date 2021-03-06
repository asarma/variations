/**
 * Text Editor for the Cloud9 IDE
 *
 * @copyright 2010, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */
define(function(require, exports, module) {
    main.consumes = ["editors", "settings"];
    main.provides = ["ace.repl"];
    return main;

    function main(options, imports, register) {
        var editors  = imports.editors;
        var settings = imports.settings;
        
        var Repl = require("./repl").Repl;
        
        var counter  = 0;
        
        /***** Initialization *****/
        
        var extensions = [];
                          
        function ReplEditor(){
            var Baseclass = editors.findEditor("ace")
            var plugin = new Baseclass(true, []);
            // var emit   = plugin.getEmitter();
            
            var currentSession;
            var ace;
            
            plugin.on("draw", function(e){
                ace = plugin.ace;
                
                if (currentSession)
                    currentSession.repl.attach(ace);
            })
            
            /***** Method *****/
            
            /***** Lifecycle *****/
            
            plugin.on("load", function(){
            });
            
            plugin.on("documentLoad", function(e){
                var session = e.doc.getSession();
                
                if (session.repl) return;
                
                session.repl = new Repl(session.session, {
                    mode      : e.state.mode,
                    evaluator : e.state.evaluator,
                    message   : e.state.message
                });
            });
            plugin.on("documentActivate", function(e){
                currentSession = e.doc.getSession();
                if (ace) 
                    currentSession.repl.attach(ace);
            });
            plugin.on("documentUnload", function(e){
                var session = e.doc.getSession();
                session.repl.detach();
                delete session.repl;
            });
            plugin.on("getState", function(e){
            });
            plugin.on("setState", function(e){
            });
            plugin.on("clear", function(){
            });
            plugin.on("focus", function(){
            });
            plugin.on("enable", function(){
            });
            plugin.on("disable", function(){
            });
            plugin.on("unload", function(){
            });
            
            /***** Register and define API *****/
            
            /**
             * Read Only Image Editor
             **/
            plugin.freezePublicAPI({
                
            });
            
            plugin.load("ace.repl" + counter++);
            
            return plugin;
        }
        
        register(null, {
            "ace.repl": editors.register("ace.repl", "Ace REPL", 
                                         ReplEditor, extensions)
        });
    }
});