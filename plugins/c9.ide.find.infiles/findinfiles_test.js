/*global describe it before after bar =*/

"use client";

require(["lib/architect/architect", "lib/chai/chai", "/vfs-root"], 
  function (architect, chai, baseProc) {
    var expect = chai.expect;
    
    expect.setupArchitectTest([
        {
            packagePath : "plugins/c9.core/c9",
            workspaceId : "ubuntu/ip-10-35-77-180",
            startdate   : new Date(),
            debug       : true,
            hosted      : true,
            local       : false,
            davPrefix   : "/"
        },
        
        "plugins/c9.core/ext",
        "plugins/c9.core/http",
        "plugins/c9.core/util",
        "plugins/c9.ide.console/console",
        "plugins/c9.ide.ui/lib_apf",
        "plugins/c9.ide.ui/tooltip",
        "plugins/c9.ide.ui/menus",
        {
            packagePath : "plugins/c9.core/settings",
            settings    : "<settings><user><general animateui='true' /></user></settings>"
        },
        {
            packagePath  : "plugins/c9.ide.ui/ui",
            staticPrefix : "plugins/c9.ide.ui"
        },
        "plugins/c9.ide.editors/document",
        "plugins/c9.ide.editors/undomanager",
        {
            packagePath: "plugins/c9.ide.editors/editors",
            defaultEditor: "ace"
        },
        "plugins/c9.ide.editors/editor",
        {
            packagePath : "plugins/c9.ide.editors/tabmanager",
            testing : 2
        },
        "plugins/c9.ide.editors/pane",
        "plugins/c9.ide.editors/tab",
        "plugins/c9.ide.ace/ace",
        {
            packagePath  : "plugins/c9.ide.find.infiles/findinfiles",
            staticPrefix : "plugins/c9.ide.find.infiles"
        },
        {
            packagePath  : "plugins/c9.ide.find/find",
            basePath     : baseProc
        },
        {
            packagePath : "plugins/c9.ide.find/find.nak",
            ignore       : ""
        },
        "plugins/c9.ide.keys/commands",
        "plugins/c9.fs/proc",
        {
            packagePath: "plugins/c9.vfs.client/vfs_client"
        },
        "plugins/c9.vfs.client/endpoint",
        "plugins/c9.ide.auth/auth",
        "plugins/c9.fs/fs",
        
        // Mock plugins
        {
            consumes : ["apf", "ui", "Plugin"],
            provides : [
                "commands", "menus", "layout", "watcher", "tree", "clipboard",
                "save", "preferences", "anims", "gotoline", "findreplace",
                "dialog.alert", "auth.bootstrap", "dialog.question"
            ],
            setup    : expect.html.mocked
        },
        {
            consumes : ["findinfiles", "tabManager", "console"],
            provides : [],
            setup    : main
        }
    ], architect);
    
    function main(options, imports, register) {
        var findinfiles = imports.findinfiles;
        var tabs        = imports.tabManager;
        
        function getTabHtml(tab){
            return tab.pane.aml.getPage("editor::" + tab.editorType).$ext
        }
        
        expect.html.setConstructor(function(tab){
            if (typeof tab == "object")
                return tab.$ext;
        });
        
        describe('ace', function() {
            this.timeout(10000);
            
            before(function(done){
                apf.config.setProperty("allow-select", false);
                apf.config.setProperty("allow-blur", false);
                
                bar.$ext.style.background = "rgba(220, 220, 220, 0.93)";
                bar.$ext.style.position = "absolute";
                bar.$ext.style.left = "20px";
                bar.$ext.style.right = "20px";
                bar.$ext.style.bottom = "50px";
                bar.$ext.style.height = "150px";
      
                document.body.style.marginBottom = "150px";
                done();
            });
            
            describe("open", function(){
                it('should open a pane with just an editor', function(done) {
                    findinfiles.toggle();
                    done();
                });
            });
            
            if (!onload.remain){
                describe("unload", function(){
                    
                    it('should open a pane with just an editor', function(done) {
                        findinfiles.unload();
                        done();
                    });
                });
                
                after(function(done){
                   imports.console.unload();
                   
                   document.body.style.marginBottom = "";
                   done();
               });
            }
        });
            
        onload && onload();
    }
});