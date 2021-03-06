define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "c9", "menus", "commands", "clipboard.provider", "ui"
    ];
    main.provides = ["clipboard"];
    return main;

    function main(options, imports, register) {
        var c9       = imports.c9;
        var ui       = imports.ui;
        var Plugin   = imports.Plugin;
        var menus    = imports.menus;
        var commands = imports.commands;
        var provider = imports["clipboard.provider"];
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit   = plugin.getEmitter();
        
        var loaded = false;
        function load(){
            if (loaded) return false;
            loaded = true;
            
            // return !(event instanceof KeyboardEvent) && !c9.readonly;
            
            function checkAvailable(editor, args, e) {
                var handler = findClipboardHandler();
                var fromKeyboard = e instanceof KeyboardEvent;
                if (handler && handler.isClipboardAvailable) {
                    return handler.isClipboardAvailable({
                        type: this.name,
                        fromKeyboard: fromKeyboard,
                        sourceEvent: e,
                        editor: editor,
                        args: args
                    });
                }
                return !!handler;
            }
            
            commands.addCommand({
                name        : "cut",
                bindKey     : { mac: "Command-X", win: "Ctrl-X" },
                isAvailable : checkAvailable,
                exec        : function(){ cut(); },
                passEvent   : true,
                readOnly    : true
            }, plugin);
            
            commands.addCommand({
                name        : "copy",
                bindKey     : { mac: "Command-C", win: "Ctrl-C" },
                isAvailable : checkAvailable,
                exec        : function(){ copy(); },
                passEvent   : true
            }, plugin);
            
            commands.addCommand({
                name        : "paste",
                bindKey     : { mac: "Command-V", win: "Ctrl-V" },
                isAvailable : checkAvailable,
                exec        : function(){ paste(); },
                passEvent   : true,
                readOnly    : true
            }, plugin);
            
            commands.addCommand({
                name        : "clearcut",
                bindKey     : { mac: "ESC", win: "ESC" },
                isAvailable : checkAvailable,
                exec        : clearcut,
                passEvent   : true
            }, plugin);
            
            menus.addItemByPath("Edit/~", new ui.divider(), 300, plugin);
            menus.addItemByPath("Edit/Cut", 
                new ui.item({ command : "cut" }), 400, plugin);
            menus.addItemByPath("Edit/Copy", 
                new ui.item({ command : "copy" }), 500, plugin);
            menus.addItemByPath("Edit/Paste", 
                new ui.item({ command : "paste" }), 600, plugin);
        }
        
        var clipboardData = {
            items : [],
            get types(){
                return clipboardData.items.map(function(item){
                    return item.type;
                });
            },
            
            wrap : function(nativeObject){ provider.wrap(nativeObject); },
            unwrap : function(){ provider.unwrap(); },
            
            setData : function(type, data){
                provider.set(type, data);
                
                var found;
                clipboardData.items.every(function(item){
                    if (item.type == type) {
                         found = item;
                         return false;
                    }
                    return true;
                });
                
                if (found) found.value = data;
                else clipboardData.items.push({ type: type, value: data });
            },
            getData : function(type, callback){
                var data = provider.get(type);
                if (data === false) {
                    var found;
                    clipboardData.items.every(function(item){
                        if (item.type == type) {
                            found = item;
                            return false;
                        }
                        return true;
                    })
                    return found && found.value || false;
                }
                    
                return data;
            },
            clearData : function(type){
                provider.clear();
                clipboardData.items = [];
                clipboardData.types = [];
            }
        };
        
        function findClipboardHandler() {
            var el = apf.activeElement || apf.menu.lastFocussed;
            
            if (!el)
                return;
            
            if (el.localName == "menu")
                el = apf.menu.lastFocussed || el;
            while (el) {
                var handler = el.clipboardHandler || el.editor;
                if (handler)
                    return handler;
                el = el.parentNode;
            }
        }
        
        /***** Methods *****/
        
        function cut(native) {
            var handler = findClipboardHandler();
            var event = {
                clipboardData: clipboardData,
                native: native,
                handler: handler
            };
            
            if (emit("beforeCut", event) === false)
                return;
            
            if (!native) clipboardData.unwrap();
            emit("cut", event);
            if (handler && handler.cut)
                handler.cut(event);
        }
    
        function copy(native) {
            var handler = findClipboardHandler();
            var event = {
                clipboardData: clipboardData,
                native: native,
                handler: handler
            };
            
            if (emit("beforeCopy", event) === false)
                return;
            
            if (!native) clipboardData.unwrap();
            emit("copy", event);
            if (handler && handler.copy)
                handler.copy(event);
        }
    
        function paste(native) {
            var handler = findClipboardHandler();
            var event = {
                clipboardData: clipboardData,
                native: native,
                handler: handler
            };
            
            if (emit("beforePaste", event) === false)
                return;
            
            if (!native) clipboardData.unwrap();
            emit("paste", event);
            if (handler && handler.paste)
                handler.paste(event);
        }
        
        function clearcut() {
            var handler = findClipboardHandler();
            if (handler && handler.clearcut)
                return handler.clearcut();
            return false;
        }
        
        function registerHandler(amlNode, clipboardHandler) {
            amlNode.clipboardHandler = clipboardHandler;
        }
    
        /***** Lifecycle *****/
        
        plugin.on("load", function(){
            load();
        });
        plugin.on("enable", function(){
            
        });
        plugin.on("disable", function(){
            
        });
        plugin.on("unload", function(){
            loaded = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * Object that represents the clipboard state and provides methods to
         * access the clipboard.
         * @class clipboard.ClipboardData
         */
        /**
         * @property {String[]} types  The content types that currently hold 
         *   data in the clipboard.
         * @readonly
         */
        /**
         * Adds an item to the clipboard, replacing any item that was there
         * with the same `type`.
         * 
         * This example shows how to store a selection of tree nodes on the
         * clipboard:
         * 
         *     var nodes = tree.getSelection();
         *     clipboardData.setData("tree-nodes", nodes);
         * 
         * @method setData
         * @param {String}   type       The content type for this data. To be 
         *   compatible with the native clipboard for all platforms use "text".
         * @param {Mixed}    data       The actual data. This can be a string
         *   or a more complex object. Complex objects cannot be stored using
         *   the native clipboard.
         */
        /**
         * Retrieves the data of an item on the clipboard.
         * 
         * This example shows how to retrieve a set of tree nodes from the 
         * clipboard:
         * 
         *     var nodes = clipboardData.getData("tree-nodes");
         * 
         * @method getData
         * @param {String}   type           The content type for this data. To be 
         *   compatible with the native clipboard for all platforms use "text".
         */
        /**
         * Clears the data from the clipboard for a certain `type`.
         * @method clearData
         * @param {String}   type           The content type for this data. To be 
         *   compatible with the native clipboard for all platforms use "text".
         */
        /**
         * Providers Clipboard access for Cloud9 plugins. The Cloud9 Clipboard 
         * abstracts away the implementation details of the different 
         * environments (e.g. Browser, Node-Webkit). The Clipboard API is 
         * loosely based on the [HTML5 Clipboard specification](http://dev.w3.org/2006/webapi/clipops/).
         * 
         * *N.B.: Usually these events are not listened to directly. Instead
         * each editor has an {@link Editor#event-cut}, {@link Editor#event-copy} and
         * {@link Editor#event-paste} event to implement. However if you are 
         * implementing a pane that is not an editor, use the events of this 
         * plugin.*
         * 
         * Example (copy):
         * 
         *     clipboard.on("copy", function(e){
         *         if (e.native) return;
         *         
         *         var data = "Example Data";
         *         e.clipboardData.setData("text/plain", data);
         *     });
         * 
         * Example (paste):
         * 
         *     clipboard.on("paste", function(e){
         *          if (e.native) return;
         *          
         *          var data = e.clipboardData.getData("text/plain");
         *      
         *      });
         * 
         * @singleton
         */
        plugin.freezePublicAPI({
            _events : [
                /**
                 * Fires when a cut, copy or paste command is executed. In order
                 * for the clipboard to work for your plugin, you will need to
                 * hook this event and return true when and only if your plugin
                 * has the focus and is capable of handling the specific action.
                 * 
                 * @event available
                 * @param {Object} e
                 * @param {String} e.type  The name of the command that is 
                 *   executed. This can be "cut", "copy" or "paste".
                 */
                "available",
                /**
                 * Fires prior to the "cut" operation.
                 * @event beforeCut
                 * @cancellable
                 * @param {Object}                  e
                 * @param {clipboard.ClipboardData} e.clipboardData  Gives 
                 *   access to the clipboard. See {@link #clipboardData}
                 */
                "beforeCut",
                /**
                 * Fires when the cut operation is executed.
                 * @event cut
                 * @param {Object}                  e
                 * @param {clipboard.ClipboardData} e.clipboardData  Gives 
                 *   access to the clipboard. See {@link #clipboardData}
                 */
                "cut",
                /**
                 * Fires prior to the "paste" operation.
                 * @event beforePaste
                 * @cancellable
                 * @param {Object}                  e
                 * @param {clipboard.ClipboardData} e.clipboardData  Gives 
                 *   access to the clipboard. See {@link #clipboardData}
                 */
                "beforePaste",
                /**
                 * Fires when the paste operation is executed.
                 * @event paste
                 * @param {Object}                  e
                 * @param {clipboard.ClipboardData} e.clipboardData  Gives 
                 *   access to the clipboard. See {@link #clipboardData}
                 */
                "paste",
                /**
                 * Fires prior to the "copy" operation.
                 * @event beforeCopy
                 * @cancellable
                 * @param {Object}                  e
                 * @param {clipboard.ClipboardData} e.clipboardData  Gives 
                 *   access to the clipboard. See {@link #clipboardData}
                 */
                "beforeCopy",
                /**
                 * Fires when the copy operation is executed.
                 * @event copy
                 * @param {Object}                  e
                 * @param {clipboard.ClipboardData} e.clipboardData  Gives 
                 *   access to the clipboard. See {@link #clipboardData}
                 */
                "copy",
                /**
                 * Fires when the user has requested to clear the cut buffer.
                 * @event clearcut
                 * @param {Object}                  e
                 * @param {clipboard.ClipboardData} e.clipboardData  Gives 
                 *   access to the clipboard. See {@link #clipboardData}
                 */
                "clearcut"
            ],
            
            
            /**
             * Object that represents the clipboard state
             * @param {AmlNode} target
             * @param {Object} handler {cut, copy, paste, clearcut, isClipboardAvailable}
             */
            registerHandler : registerHandler,
            
            /**
             * Object that represents the clipboard state
             * @property {clipboard.ClipboardData}
             */
            clipboardData: clipboardData,
            
            /**
             * Triggers a cut by the currently focused component.
             * @fires beforeCut
             * @fires cut
             */
            cut : cut,
            
            /**
             * Triggers a copy by the currently focused component.
             * @fires beforeCopy
             * @fires copy
             */
            copy : copy,
            
            /**
             * Triggers a paste by the currently focused component.
             * @fires beforePaste
             * @fires paste
             */
            paste : paste
        });
        
        register(null, {
            clipboard: plugin
        });
    }
});