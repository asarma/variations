define(function(require, exports, module) {
    "use strict";
    
    main.consumes = [
        "Plugin", "settings", "ui", "layout",
        "anims", "menus", "tabManager", "commands", "tooltip", "apf"
    ];
    main.provides = ["findreplace"];
    return main;

    function main(options, imports, register) {
        var Plugin    = imports.Plugin;
        var settings  = imports.settings;
        var ui        = imports.ui;
        var anims     = imports.anims;
        var menus     = imports.menus;
        var layout    = imports.layout;
        var commands  = imports.commands;
        var tooltip   = imports.tooltip;
        var tabs      = imports.tabManager;
        var apf       = imports.apf;

        var css       = require("text!./findreplace.css");
        var skin      = require("text!./skin.xml");
        var markup    = require("text!./findreplace.xml");
        
        var lib       = require("plugins/c9.ide.find.replace/libsearch");
        
        var asyncSearch = require("./async_search");
        var Range       = require("ace/range").Range;

        /***** Initialization *****/

        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit   = plugin.getEmitter();

        var libsearch = lib(settings, execFind, toggleDialog, restore, toggleOption);

        var findinfiles, searchRow, txtFind, winSearchReplace, txtReplace;
        var tooltipSearchReplace, divSearchCount; 
        var btnPrev, btnNext, btnReplace, btnReplaceAll, hbox, btnCollapse;
        var chk = {};

        var currentRange, lastSearchOptions;
        var timer, startPos = {};

        function toggleOption() {
            var ch;
            switch (this.name) {
                case "regex": ch = chk.regEx; break;
                case "wholeWords": ch = chk.wholeWords; break;
                case "matchCase": ch = chk.matchCase; break;
            }
            ch.change(!ch.checked, true);

            execFind();
        }
        
        var loaded = false;
        function load(){
            if (loaded) return false;
            loaded = true;

            function isSupported(editor){
                if (apf.activeElement === txtFind || apf.activeElement === txtReplace)
                    return true;
                return editor && editor.ace;
            }
            
            function isSupportedRW(editor){
                var ace = isSupported(editor);
                return ace === true || !ace ? ace : !ace.getOption("readOnly");
            }

            commands.addCommands({
                replace: {
                    bindKey     : { mac: "Option-Command-F", win: "Alt-Shift-F|Ctrl-H" },
                    hint        : "search for a string inside the active document and replace it",
                    isAvailable : isSupportedRW,
                    exec        : function(env, args, request){
                        toggleDialog(1, true);
                    }
                }, 
                replaceall: {
                    bindKey     : { mac: "", win: "" },
                    hint        : "search for a string inside the active document and replace all",
                    isAvailable : isSupportedRW,
                    exec        : function(env, args, request){
                        replaceAll();
                    }
                },
                replacenext: {
                    isAvailable : isSupportedRW,
                    exec : function(env, args, request) {
                        replace();
                    }
                },
                replaceprevious: {
                    isAvailable : isSupportedRW,
                    exec : function(env, args, request) {
                        replace(true);
                    }
                },
                findnext: {
                    isAvailable : isSupported,
                    bindKey: {mac: "Command-G", win: "Ctrl-K"},
                    exec: function(editor) { 
                        findAgain(editor.ace);
                    },
                },
                findprevious: {
                    isAvailable : isSupported,
                    bindKey: {mac: "Command-Shift-G", win: "Ctrl-Shift-K"},
                    exec: function(editor) {
                        findAgain(editor.ace, true);
                    },
                },
                find: {
                    hint        : "open the quicksearch dialog to quickly search for a phrase",
                    bindKey     : { mac: "Command-F", win: "Ctrl-F" },
                    isAvailable : isSupported,
                    exec        : function(env, args, request) {
                        toggleDialog(1, false);
                    }
                },
                hidesearchreplace: {
                    bindKey     : {mac: "ESC", win: "ESC"},
                    isAvailable : function(editor){
                        return winSearchReplace && winSearchReplace.visible;
                    },
                    exec : function(env, args, request) {
                        toggleDialog(-1);
                    }
                }
            }, plugin);

            menus.addItemByPath("Find/Find...", new apf.item({
                command : "find"
            }), 100, plugin);
            menus.addItemByPath("Find/Find Next", new apf.item({
                command : "findnext"
            }), 200, plugin);
            menus.addItemByPath("Find/Find Previous", new apf.item({
                command : "findprevious"
            }), 300, plugin);
            menus.addItemByPath("Find/~", new apf.divider(), 400, plugin);
            menus.addItemByPath("Find/Replace...", new apf.item({
                command : "replace"
            }), 500, plugin);
            menus.addItemByPath("Find/Replace Next", new apf.item({
                command : "replacenext",
            }), 600, plugin);
            menus.addItemByPath("Find/Replace Previous", new apf.item({
                command : "replaceprevious",
            }), 700, plugin);
            menus.addItemByPath("Find/Replace All", new apf.item({
                command : "replaceall"
            }), 800, plugin);
            
            tabs.on("focus", function(e){
                if (winSearchReplace && winSearchReplace.visible) {
                    if (e.tab && e.tab.editor.ace) {
                        winSearchReplace.enable();
                        execFind(false, "highlight");
                    }
                    else {
                        winSearchReplace.disable();
                        btnCollapse.enable();
                        updateCounter();
                    }
                }
            });
        }

        var drawn = false;
        function draw(){
            if (drawn) return;
            drawn = true;

            // Import CSS
            ui.insertCss(css, options.staticPrefix, plugin);

            // Import Skin
            ui.insertSkin({
                name         : "searchreplace",
                data         : skin,
                "media-path" : options.staticPrefix + "/images/",
                "icon-path"  : options.staticPrefix + "/icons/"
            }, plugin);

            // Create UI elements
            searchRow = layout.findParent(plugin);
            ui.insertMarkup(null, markup, plugin);

            // Get ref to find in files
            findinfiles = lib.findinfiles;

            txtFind              = plugin.getElement("txtFind");
            winSearchReplace     = plugin.getElement("winSearchReplace");
            txtReplace           = plugin.getElement("txtReplace");
            tooltipSearchReplace = plugin.getElement("tooltipSearchReplace");
            chk.searchSelection  = plugin.getElement("chkSearchSelection");
            divSearchCount       = plugin.getElement("divSearchCount");
            hbox                 = plugin.getElement("hbox");
            chk.regEx            = plugin.getElement("chkRegEx");
            chk.searchBackwards  = plugin.getElement("chkSearchBackwards");
            chk.wrapAround       = plugin.getElement("chkWrapAround");
            chk.matchCase        = plugin.getElement("chkMatchCase");
            chk.wholeWords       = plugin.getElement("chkWholeWords");
            chk.preserveCase     = plugin.getElement("chkPreserveCase");
            btnPrev              = plugin.getElement("btnPrev");
            btnNext              = plugin.getElement("btnNext");
            btnReplace           = plugin.getElement("btnReplace");
            btnReplaceAll        = plugin.getElement("btnReplaceAll");
            btnCollapse          = plugin.getElement("btnCollapse");

            btnNext.on("click", function(){ findNext(false); });
            btnPrev.on("click", function(){ findNext(true); });
            btnReplace.on("click", function(){ replace(); });
            btnReplaceAll.on("click", function(){ replaceAll(); });
            btnCollapse.on("click", function(){ toggleDialog(-1); });

            txtFind.$ext.appendChild(divSearchCount.$ext);
            txtFind.$ext.appendChild(btnPrev.$ext);
            txtFind.$ext.appendChild(btnNext.$ext);

            var timer, control;
            txtReplace.on("focus", function(){
                if (control) control.stop();
                control = {};

                // I'd rather use css anims, but they didn't seem to work
                apf.tween.single(txtReplace.$ext.parentNode, {
                    type     : "boxFlex",
                    from     : txtReplace.$ext.parentNode.style[apf.CSSPREFIX + "BoxFlex"] || 1,
                    to       : 3,
                    anim     : apf.tween.easeOutCubic,
                    control  : control,
                    steps    : 15,
                    interval : 1
                });
            });
            txtReplace.on("blur", function(){
                if (txtReplace.getValue())
                    return;
                    
                if (control) control.stop();
                control = {};

                // I'd rather use css anims, but they didn't seem to work
                apf.tween.single(txtReplace.$ext.parentNode, {
                    type     : "boxFlex",
                    from     : txtReplace.$ext.parentNode.style[apf.CSSPREFIX + "BoxFlex"] || 3,
                    to       : 1,
                    anim     : apf.tween.easeOutCubic,
                    control  : control,
                    steps    : 15,
                    interval : 1
                });
            });

            settings.on("read", function(e){
                settings.setDefaults("state/ace/search", [
                    ["regex", "false"],
                    ["matchcase", "false"],
                    ["wholeword", "false"],
                    ["backwards", "false"],
                    ["wraparound", "true"],
                    ["highlightmatches", "true"],
                    ["preservecase", "false"]
                ]);
            }, plugin);

            var kb = libsearch.addSearchKeyboardHandler(txtReplace, "replace");
            kb.bindKeys({
                "Return": function(codebox) { replace(); },
                "Shift-Return": function(codebox) { replace(true); }
            });

            document.body.appendChild(tooltipSearchReplace.$ext);

            chk.regEx.on("prop.value", function(e){
                libsearch.setRegexpMode(txtFind, apf.isTrue(e.value));
            });

            decorateCheckboxes(hbox);

            libsearch.addSearchKeyboardHandler(txtFind, "search");
            txtFind.ace.session.on("change", function(e) {
                clearTimeout(timer);
                var find = !libsearch.keyStroke;
                timer = setTimeout(function() {
                    execFind(false, find ? false : "highlight");
                }, 20);
            });
            
            txtFind.ace.commands.on("exec", function(e) {
                if (/centerselection|fold/i.test(e.command.name)) {
                    getAce().execCommand(e.command.name);
                    e.preventDefault();
                    e.stopPropagation();
                }
            });
            
            initFindInRange();

            emit("draw");
        }

        /***** Methods *****/

        function decorateCheckboxes(parent){
            var cbs = parent.selectNodes("//a:checkbox");

            cbs.forEach(function(cb){
                cb.on("click", function(){
                    execFind();
                });

                tooltip.add(cb.$ext, {
                    message     : cb.label,
                    width       : "auto",
                    timeout     : 0,
                    tooltip     : tooltipSearchReplace.$ext,
                    animate     : false,
                    getPosition : function(){
                        var pos = ui.getAbsolutePosition(winSearchReplace.$ext);
                        var left = pos[0] + cb.getLeft();
                        var top = pos[1];
                        return [left, top - 16];
                    }
                }, plugin);
            });
        }

        function updateCounter(total, current, msg, wrapped) {
            var oIter = divSearchCount.$ext;            
            if (!oIter) return;
            
            msg = msg || "";
            
            var color = wrapped ? "blue" : "";
            
            if (typeof total == "number" && typeof current == "number") {
                if (!total) {
                    current = 0;
                    color = "red";
                } else {
                    current = getOptions().backwards ? total - current : current + 1;
                }
                msg = current + " of " + total + msg;
            }
            oIter.style.color = color;
            oIter.textContent = msg;
        }

        function setStartPos(ace){
            startPos.searchRange = 
            startPos.range = ace.getSelectionRange();
            startPos.scrollTop = ace.session.getScrollTop();
            startPos.scrollLeft = ace.session.getScrollLeft();
        }

        function initFromEditor(ace){
            if (!ace.selection.isEmpty() && !ace.selection.isMultiLine())
                txtFind.setValue(ace.getCopyText());
        }

        function toggleDialog(force, isReplace, noselect, callback) {
            var tab   = tabs.focussedTab;
            var editor = tab && tab.editor;

            draw();

            tooltipSearchReplace.$ext.style.display = "none";

            if (!force && !winSearchReplace.visible || force > 0) {
                if (!editor || !editor.ace)
                    return;
                
                winSearchReplace.enable();
                
                var ace = getAce();
                var fromEditor = ace && editor && editor.ace == ace;
                if (fromEditor) {
                    if (!isReplace)
                        initFromEditor(ace);

                    setStartPos(ace);
                }

                if (!winSearchReplace.visible)
                    showUi(callback);

                // chk.searchSelection.uncheck();
                var input = isReplace ? txtReplace : txtFind;
                input.focus();
                input.select();
            }
            else if (winSearchReplace.visible) {
                txtFind.ace.saveHistory();
                if (!noselect)
                    tabs.focusTab(tab);
                hideUi(null, callback);
            }
            else if (callback)
                callback();

            return false;
        }

        function showUi(callback) {
            btnReplaceAll.setCaption(searchRow.getWidth() < 800 ? "All" : "Replace All");

            winSearchReplace.$ext.style.overflow = "hidden";
            winSearchReplace.$ext.style.height   =
                winSearchReplace.$ext.offsetHeight + "px";
            searchRow.appendChild(winSearchReplace);
            winSearchReplace.show();

            var winFindInFiles;
            try{
                winFindInFiles = findinfiles.getElement("winSearchInFiles");
            } catch(e) {}
            if (winFindInFiles && winFindInFiles.visible) {
                findinfiles.toggle(-1, null, true, function(){
                    showUi(callback);
                });
                return;
            }

            anims.animateSplitBoxNode(winSearchReplace, {
                height         : winSearchReplace.$ext.scrollHeight + "px",
                duration       : 0.2,
                timingFunction : "cubic-bezier(.10, .10, .25, .90)"
            }, function() {
                winSearchReplace.$ext.style.height = "";
                divSearchCount.$ext.style.visibility = "";
            });

            btnCollapse.setValue(1);
        }

        function hideUi(animate, callback) {
            if (animate == undefined)
                animate = settings.getBool("user/general/@animateui");
            winSearchReplace.visible = false;

            winSearchReplace.$ext.style.height
                = winSearchReplace.$ext.offsetHeight + "px";

            // Animate
            if (animate) {
                anims.animateSplitBoxNode(winSearchReplace, {
                    height         : "0px",
                    duration       : 0.2,
                    timingFunction : "ease-in-out"
                }, function(){
                    winSearchReplace.visible = true;
                    winSearchReplace.hide();
                    if (winSearchReplace.parentNode)
                        winSearchReplace.parentNode.removeChild(winSearchReplace);

                    setTimeout(function(){
                        callback && callback();
                    }, 50);
                });
            }
            else {
                winSearchReplace.visible = true;
                winSearchReplace.hide();
                winSearchReplace.parentNode.removeChild(winSearchReplace);

                callback
                    ? callback()
                    : ui.layout.forceResize();
            }

            btnCollapse.setValue(0);
        }

        function restore() {
            if (!startPos)
                return false;

            var editor = getAce();
            editor.selection.setSelectionRange(startPos.range);
            editor.session.setScrollTop(startPos.scrollTop);
            editor.session.setScrollLeft(startPos.scrollLeft);
        }

        function onHide() {
            var tab = tabs.focussedTab;
            if (tab && tab.editor.ace)
                tabs.focusTab(tab);
        }

        function getOptions() {
            var options = {
                backwards     : chk.searchBackwards.checked,
                wrap          : chk.wrapAround.checked,
                caseSensitive : chk.matchCase.checked,
                wholeWord     : chk.wholeWords.checked,
                regExp        : chk.regEx.checked
            };

            if (chk.searchSelection.checked) {
                var range = getAce().getSelectionRange();
                var isValid = range.isMultiLine() || range.end.column - range.start.column > 10;
                if (!isValid || currentRange && range.isEqual(currentRange))
                    range = null;
                
                startPos.searchRange =
                options.range = range || startPos.searchRange;
            }

            return options;
        }

        function findNext(backwards) {
            execFind(backwards, true);
        }

        /*
         * type can be highlight-> only update highlighting, 
         *      next|true -> skip current selection
         *      falsy -> do not skip current
         */
        function execFind(reverseBackwards, type, options, callback) {
            var ace = getAce();
            if (!ace)
                return;

            if (timer)
                timer = clearTimeout(timer);

            var searchTxt = txtFind.getValue();

            if (!options)
                options = getOptions();

            if (reverseBackwards)
                options.backwards = !options.backwards;

            if (options.regExp) {
                libsearch.checkRegExp(txtFind,
                    tooltipSearchReplace, winSearchReplace);
            }

            var range = ace.selection.getRange();
            
            if (type === true)
                type = "next";
            
            if (type == "next")
                txtFind.ace.saveHistory();
            
            if (type == "next" || !currentRange)
                currentRange = range;

            options.skipCurrent = type == "next";
            options.start = currentRange;

            options.needle = searchTxt;
            
            if (options.range && type != "highlight")
                addFindInRangeMarker(options.range, ace.session);
            else
                removeFindInRangeMarker();
            
            var re = ace.$search.$assembleRegExp(options, true);
            if (!re) {
                updateCounter();
                if (type != "highlight") {
                    var pos = options.start[options.backwards? "end" : "start"];
                    var newRange = Range.fromPoints(pos, pos);
                    ace.revealRange(newRange);
                }
                return callback && callback();
            }
            
            if (type != "highlight") {
                lastSearchOptions = options;
            }

            options.re = re;
            options.source = re.source;
            options.flags = re.ignoreCase ? "igm" : "gm";
            asyncSearch.execFind(ace.session, options , function(result) {
                if (result == "waiting")
                    return updateCounter("...");

                result = result || {total: 0, current: 0};
                updateCounter(result.total, result.current, null, result.wrapped);
                
                if (!result.start || !result.end) {
                    result.start = 
                    result.end = range[!options.backwards ? "start": "end"];
                }
                var newRange = Range.fromPoints(result.start, result.end);
                
                if (type == "next" && newRange)
                    currentRange = newRange;

                if (newRange && type != "highlight")
                    ace.revealRange(newRange);

                // highlight
                ace.session.highlight(re);
                ace.session._signal("changeBackMarker");
                
                callback && callback();
            });
        }
        
        function findAgain(ace, backwards) {
            if (!ace.selection.isEmpty() && lastSearchOptions) {
                var text = ace.session.getTextRange();
                var match = lastSearchOptions.re && lastSearchOptions.re.exec(text);
                if (!match || match[0] != text)
                    lastSearchOptions = null;
            }

            if (lastSearchOptions) {
                lastSearchOptions.backwards = backwards;
                execFind(null, true, lastSearchOptions);
            } else
                backwards ? ace.findPrevious() : ace.findNext();
        }
        
        function find() {
            toggleDialog(1);
            return false;
        }

        function replace(backwards) {
            var ace = getAce();
            if (!ace)
                return;

            var strReplace = processEscapes(txtReplace.getValue());

            var txt = ace.getCopyText();
            var options = getOptions();
            options.needle = txtFind.getValue();
            ace.$search.set(options);
            ace.$search.set({preserveCase: chk.preserveCase.checked});
            strReplace = ace.$search.replace(txt, strReplace);
            if (typeof strReplace == "string")
                ace.insert(strReplace);
            findNext(backwards);
            
            txtReplace.ace.saveHistory();
        }

        function replaceAll() {
            var ace = getAce();
            if (!ace)
                return;

            var options = getOptions();
            options.needle = txtFind.getValue();
            var strReplace = processEscapes(txtReplace.getValue());
            ace.replaceAll(strReplace, options);
            updateCounter();
            
            txtReplace.ace.saveHistory();
        }

        function processEscapes(str) {
            var lut = {"n": "\n", "t": "\t", "r": "\r"};
            return str.replace(/(\\\\)+|\\([ntr])/g, function(m, m1, m2) {
                return m1 || lut[m2];
            });
        }

        function getAce() {
            var tab = tabs.focussedTab;
            var editor = tab && tab.editor;
            return editor && editor.ace;
        }
        
        var marker;
        function addFindInRangeMarker(range, session) {
            removeFindInRangeMarker();

            if (!range || !session || range.isEmpty())
                return;

            var start = new Range(0, 0, range.start.row, range.start.column);
            var end = new Range(range.end.row, range.end.column, Number.MAX_VALUE, Number.MAX_VALUE);
            start.id = session.addMarker(start, "findInRangeMarker", true, "line", true);
            end.id = session.addMarker(end, "findInRangeMarker", true, "line", true);
            
            start.end = session.doc.createAnchor(start.end.row, start.end.column);
            end.start = session.doc.createAnchor(end.start.row, end.start.column);

            return marker = {start: start, end: end, session: session};
        }
        
        function removeFindInRangeMarker() {
            if (!marker) return;
            var session = marker.session;
            session.removeMarker(marker.start.id);
            session.removeMarker(marker.end.id);
            
            marker.start.end.detach();
            marker.end.start.detach();
            marker = null;
        }
        
        function initFindInRange() {
            winSearchReplace.addEventListener("focus", function(e) {
                var ace = getAce();
                if (ace && e.fromElement && e.fromElement.editor) {
                    if (e.fromElement.editor.ace == ace)
                        setStartPos(ace);
                    
                    execFind(false, "highlight");
                }
                
                if (chk.searchSelection.checked)
                    addFindInRangeMarker(getOptions().range, ace.session);
                else
                    removeFindInRangeMarker(marker);
                currentRange = null;
            });
            winSearchReplace.addEventListener("blur", function(e) {
                if (marker) {
                    removeFindInRangeMarker(marker);
                    marker = null;
                }
            });
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
         * Implements the search and replace UI for Cloud9 IDE.
         * @singleton
         */
        /**
         * Fetches a ui element. You can use this method both sync and async.
         * 
         * The search in files plugin has the following elements:
         * 
         * * txtFind - `{ui.textbox}`
         * * winSearchReplace - `{ui.window}`
         * * txtReplace - `{ui.textbox}`
         * * tooltipSearchReplace - `{ui.label}`
         * * chkSearchSelection - `{ui.checkbox}`
         * * chkRegEx - `{ui.checkbox}`
         * * chkSearchBackwards - `{ui.checkbox}`
         * * chkWrapAround - `{ui.checkbox}`
         * * chkMatchCase - `{ui.checkbox}`
         * * chkWholeWords - `{ui.checkbox}`
         * * chkPreserveCase - `{ui.checkbox}`
         * * btnPrev - `{ui.button}`
         * * btnNext - `{ui.button}`
         * * btnReplace - `{ui.button}`
         * * btnReplaceAll - `{ui.button}`
         * * btnCollapse - `{ui.button}`
         * 
         * @method getElement
         * @param {String}   name       the id of the element to fetch.
         * @param {Function} [callback] the function to call when the 
         *     element is available (could be immediately)
         */
        plugin.freezePublicAPI({
            /**
             * Toggles the visibility of the search and replace panel.
             * @param {Number} force  Set to -1 to force hide the panel, 
             *   or set to 1 to force show the panel.
             */
            toggle : toggleDialog,

            /**
             * Return the cursor and selection to where it was, prior to 
             * starting searching.
             */
            restore : restore,

            /**
             * Find the next occurance of the search query. If wrap around is
             * turned on, the search will continue from the beginning when it
             * reaches the end of the file.
             * @param {Boolean} backwards  When set to true the search direction is reversed.
             */
            findNext : findNext,

            /**
             * Replace the next occurance of the query with whatever the user
             * entered in the replace textbox.
             * @param {Boolean} backwards  When set to true the search direction is reversed.
             */
            replace : replace,

            /**
             * Replace all occurences of the query with whatever the user
             * entered in the replace textbox.
             */
            replaceAll : replaceAll
        });

        register(null, {
            findreplace: plugin
        });
    }
});