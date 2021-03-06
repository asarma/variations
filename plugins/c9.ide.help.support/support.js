define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "ui", "menus", "c9", "auth", "dialog.alert"
    ];
    main.provides = ["myplugin"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui     = imports.ui;
        var c9     = imports.c9;
        var menus  = imports.menus;
        var auth   = imports.auth;
        var alert  = imports["dialog.alert"].show;
        
        var attachmentSizeLimit = 1024*1024*2;  // limit size of attachment to <= 2MB
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit   = plugin.getEmitter();
        
        var form, confirmation, btnSend, btnClose, subject, description, win;
        var attachment, confirmationMessage;
        
        var baseurl = options.baseurl;
        var FILEREADER_URL = "/api/provision/filereader-fallback/images";
        var FILETICKET_URL = "/api/context/fileticket";
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            menus.addItemByPath("Help/Support/Report a bug...", new apf.item({
                onclick: function() {
                    draw();
                    win.show();
                }
            }), 500, plugin);
        }
        
        var drawn = false;
        function draw() {
            if (drawn) return;
            drawn = true;
            
            // Create UI elements
            var markup = require("text!./support.xml");
            ui.insertMarkup(null, markup, plugin);
            
            win          = plugin.getElement("win");
            form         = plugin.getElement("form");
            confirmation = plugin.getElement("confirmation");
            btnSend      = plugin.getElement("btnSend");
            btnSend      = plugin.getElement("btnSend");
            btnClose     = plugin.getElement("btnClose");
            subject      = plugin.getElement("subject");
            description  = plugin.getElement("description");
            attachment   = plugin.getElement("attachment");
            confirmationMessage = plugin.getElement("confirmationMessage");
            
            btnClose.on("click", function(){ closeWindow(); });
            btnSend.on("click", function(){ fileTicket(); });
        
            emit("draw");
        }
        
        /***** Methods *****/
        
        /**
         * fileTicket
         *
         * This function is called when pressing the Send button. It sends the contents
         * of the form to the Zendesk Cloud9 IDE account, creating a support ticket
         * there.
         */
        function fileTicket() {
            btnSend.setAttribute("disabled", true);
            var fileHandler = attachment.$ext.getElementsByTagName('input')[0].files[0];
            if (fileHandler) { // there is an attachment
                if (fileHandler.size > attachmentSizeLimit) {
                    alert("Upload failed", "Attachment size exceeds limit", 
                        "Please limit the size of the attachment to less than 2 MB.");
                    // Reenable Send button and clear file chooser
                    btnSend.setAttribute("disabled", false);
                    clearFileChooser();
                    return;
                }
    
                if (window.FileReader) {
                    var reader = new FileReader();
                    reader.onload = (function (file) {
                        var attachedFile = {
                            binary : file.currentTarget.result,
                            name : fileHandler.name
                        };
                        sendTicketToServer(attachedFile);
                    });
                    reader.readAsBinaryString(fileHandler);
                }
                else { // Safari hack
                    auth.request(baseurl + FILEREADER_URL, {
                        method  : "POST",
                        body    : fileHandler,
                        headers : {
                            "Content-Type" : "application/octet-stream",
                            "UP-FILENAME"  : fileHandler.name,
                            "UP-SIZE"      : fileHandler.size,
                            "UP-TYPE"      : fileHandler.type
                        }
                    }, function(err, data, res){
                        if (res.status === 200) {
                            var attachedFile = {
                                binary : res.body,
                                name   : fileHandler.name
                            };
                            sendTicketToServer(attachedFile);
                        }
                        else {
                            alert("Upload failed", "Uploading the file failed",
                                "The server responded with status " + res.status 
                                + ". Please try again.");
                        }
                    });
                }
            }
            else {  // no attachment
                sendTicketToServer();
            }
    
            function sendTicketToServer(attachedFile) {
                var postData = {
                    "subject"     : subject.getValue(),
                    "description" : description.getValue(),
                    "projectName" : c9.projectName,
                    "userAgent"   : navigator.userAgent
                };
                if (attachedFile) {
                    postData.attachmentName = attachedFile.name;
                    postData.attachmentBinary = attachedFile.binary;
                }
                var keys = Object.keys(postData);
                var keyValueArray = keys.map(function (key) {
                    return encodeURIComponent(key) + "=" 
                        + encodeURIComponent(postData[key]);
                });
                var postString = keyValueArray.join("&");
    
                auth.request(baseurl + FILETICKET_URL, {
                    method      : "POST",
                    body        : postString,
                    contentType : "application/x-www-form-urlencoded"
                }, function callback(err, data, res) {
                    if (err || res.status != 200) {
                        return alert("Error filing Zendesk ticket",
                            "Please email us at support@c9.io",
                            typeof data === "string" 
                                ? data : JSON.stringify(data));
                    }
                    
                    try {
                        data = JSON.parse(data);
                    }
                    catch(e){ return callback(e) }
                    
                    // Show confirmation message
                    confirmationMessage.setAttribute("caption",
                        "<center>Thanks for your report.<br><br>"
                        + "Our support team will get in touch<br>"
                        + "with you as soon as possible at<br><b>" 
                        + apf.escapeXML(data["email"]) + "</b></center>");
                        
                    form.setProperty("visible", false);
                    confirmation.setProperty("visible", true);
                    btnSend.hide();
                    btnClose.setCaption("Close");
                });
            }
        }
    
        function clearFileChooser() {
            // Clear the file chooser. A bit hacky, but it works.
            var fileChooser = document.getElementById("fileChooser");
            fileChooser.innerHTML = fileChooser.innerHTML;
        }
    
        function closeWindow() {
            win.hide();
            
            // Set the "Report a bug" form back to it's original state
            form.setProperty("visible", true);
            confirmation.setProperty("visible", false);
            btnSend.setAttribute("disabled", false);
            btnSend.show();
            btnClose.setCaption("Cancel");
            subject.setValue("");
            description.setValue("");
            
            clearFileChooser();
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("enable", function() {
            
        });
        plugin.on("disable", function() {
            
        });
        plugin.on("unload", function() {
            loaded = false;
            drawn  = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * "File a ticket" module for Cloud9 IDE
         *
         * Inserts a menu item under the "Help" menu, which, upon being
         * clicked displays a window where a user can file support ticket.
         */
        plugin.freezePublicAPI({
            _events : [
                /**
                 * @event draw
                 */
                "draw"
            ]
        });
        
        register(null, {
            myplugin: plugin
        });
    }
});