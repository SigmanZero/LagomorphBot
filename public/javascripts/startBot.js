var tmi = require('tmi.js');
var fs = require("fs");
var https = require('https');
var cleverbot = require("cleverbot.io");
var birdPuns = require("bird-puns");

var giphyAPI = require('giphy-js-sdk-core');
giphy = giphyAPI(process.env.GIPHY_API_KEY);

var firebase = require("firebase-admin");
var serviceAccount = require("../../lagomorph-a98ac-firebase-adminsdk-f0dwn-cb73b00e43.json");
firebase.initializeApp({
    credential: firebase.credential.cert(serviceAccount),
    databaseURL: "https://lagomorph-a98ac.firebaseio.com"
});
var database = firebase.database();

var dotEnv = require('dotenv');
dotEnv.config();

var scope = {};
var commandChar = '!';
var nextCommand = Date.now();
var channel = "CrippeldJoe";

var currentColor;
var colors = [];
var channelCommands = [];
var commonCommands = [];
var responseWords = [];
var commandsLoaded = false;
var wordsLoaded = false;

var tmiOptions = {
    options: {
        debug: true
    },
    connection: {
        cluster: "aws",
        reconnect: true
    },
    identity: {
        username: "LagomorphBot",
        password: process.env.LAGOMORPH_OAUTH
    },
    /*identity: {
        username: "SigmanZero",
        password: process.env.SIGMANZERO_OAUTH
    },*/
    channels: [channel]
};

var client = new tmi.client(tmiOptions);
client.connect();

client.on("connected", function(address, port){
    database.ref("colors").once('value').then(function(snapshot){
        colors = snapshot.val();
        database.ref("init").once('value').then(function(snapshot){
            var initMessages = snapshot.val();
            sendAction(initMessages[randInt(0, initMessages.length)]);
        });
    });

    database.ref("channels/" + channel).once('value').then(function(snapshot){
        if(snapshot.val() === null) {
            var newChannel = {commands: {test: ""}, response: {test: ""}};
            database.ref("channels/" + channel).set(newChannel);
        }
    });

    database.ref("commands").once('value').then(function(snapshot){
        commonCommands = snapshot.val();
        database.ref("channels/" + channel + "/commands").once('value').then(function(snapshot){
            channelCommands = snapshot.val();
            commandsLoaded = true;
        });
    });
    database.ref("channels/" + channel + "/response").once('value').then(function(snapshot){
        responseWords = snapshot.val();
        wordsLoaded = true;
    });
});

function randInt(min, max){
    if(Math.floor(min) !== min || Math.floor(max) !== max){
        console.error("Need integer arguments for randInt.");
        return 0;
    }
    return Math.floor(Math.random() * (max - min)) + min;
}

function randColor(){
    var newColor;
    do {
        newColor = randInt(0, colors.length);
    } while (currentColor !== undefined && newColor === currentColor);
    currentColor = newColor;
    client.color(colors[currentColor]);
}

function sendMessage(message){
    randColor();
    client.say(channel, message);
}

function sendAction(message){
    randColor();
    client.action(channel, message);
}

client.on("chat", function(channel, userstate, message, self) {
    if(!commandsLoaded || !wordsLoaded) {
        sendAction("Please wait, still loading...");
    } else {
        if (self) return;

        var msgSplit = message.split(" ");

        if (message[0] === commandChar) {
            // +++++ Command +++++
            if (Date.now() < nextCommand) return;

            var cmd = msgSplit[0].substr(1).toUpperCase();
            if (channelCommands[cmd] !== undefined) {
                if(channelCommands[cmd] === ""){
                    scope[cmd](userstate, msgSplit);
                } else {
                    sendMessage(channelCommands[cmd]);
                }

                nextCommand = Date.now() + 2000;
            } else if (commonCommands[cmd] !== undefined){
                if(commonCommands[cmd] === ""){
                    scope[cmd](userstate, msgSplit);
                } else {
                    sendMessage(commonCommands[cmd]);
                }
            }
        } else {
            // +++++ Response Word +++++
            for(var i = 0, len = msgSplit.length; !!responseWords && i < len; ++i){
                if(responseWords[msgSplit[i]] !== undefined){
                    sendMessage(responseWords[msgSplit[i]]);
                }
            }
        }
    }
});

scope.HI = function(user, msg){
    scope.HELLO(user, msg);
};

scope.HELLO = function(user, msg){
    var greetings = ["Hi", "Hello", "Wassssssuuuuppppp", "Yooooooooooo"];
    sendMessage(greetings[randInt(0, greetings.length)] + ", " + user["display-name"] + "!");
};

scope.EXPOSED = function(user, msg){
    if(user.mod) {
        if (msg.length > 2 && msg[1] === "add") {
            var publication = "";
            for (var i = 2, len = msg.length; i < len; ++i) {
                publication += msg[i].toUpperCase() + " ";
            }
            var d = new Date();
            publication += "-" + (d.getMonth() + 1) + "/" + d.getDate() + "/" + d.getFullYear();
            database.ref("exposed/" + channel).push().set(publication, function (err) {
                if (err === null) {
                    sendMessage("Publication Saved!");
                } else {
                    console.error(err);
                    sendMessage("Error saving publication.");
                }
            });
            return;
        }
    }

    database.ref("exposed/" + channel).once('value').then(function(snapshot){
        if(snapshot.val() === null){
            sendMessage("Error getting publications.");
        }
        var pubs = Object.keys(snapshot.val());
        sendAction("SwiftRage " + channel.toUpperCase() + " EXPOSED! SwiftRage " + snapshot.val()[pubs[randInt(0, pubs.length)]]);
    });
};

scope.ADD = function(user, msg){
    if(user.mod && msg.length > 2){
        var cmdTrigger = msg[1].toUpperCase();
        if(channelCommands[cmdTrigger] !== undefined || commonCommands[cmdTrigger] !== undefined) {
            sendMessage("Command already exists.");
        } else {
            var cmd = "";
            for(var i = 2, len = msg.length - 1; i < len; ++i){
                cmd += msg[i] + " ";
            }
            cmd += msg[msg.length - 1];
            database.ref("channels/" + channel + "/commands/" + cmdTrigger).set(cmd, function(err){
                if(err === null){
                    sendMessage("Command created!");
                    channelCommands[cmdTrigger] = cmd;
                } else {
                    console.error(err);
                    sendMessage("Error creating command.");
                }
            });
        }
    }
};

scope.EDIT = function(user, msg){
    if(user.mod && msg.length > 2){
        var cmdTrigger = msg[1].toUpperCase();
        if(channelCommands[cmdTrigger] === undefined){
            sendMessage("Command doesn't exist.");
        } else {
            var cmd = "";
            for(var i = 2, len = msg.length - 1; i < len; ++i){
                cmd += msg[i] + " ";
            }
            cmd += msg[msg.length - 1];
            database.ref("channels/" + channel + "/commands/" + cmdTrigger).set(cmd, function(err){
                if(err === null){
                    sendMessage("Command edited!");
                    channelCommands[cmdTrigger] = cmd;
                } else {
                    console.error(err);
                    sendMessage("Error editing command.");
                }
            });
        }
    }
};

scope.REMOVE = function(user, msg){
    if(user.mod && msg.length > 1){
        var cmdTrigger = msg[1].toUpperCase();
        if(channelCommands[cmdTrigger] === undefined){
            sendMessage("Command doesn't exist.");
        } else {
            database.ref("channels/" + channel + "/commands/" + cmdTrigger).remove(function(err){
                if(err === null){
                    sendMessage("Command removed!");
                    delete channelCommands[cmdTrigger];
                } else {
                    console.error(err);
                    sendMessage("Error removing command.");
                }
            });
        }
    }
};

scope.BLAME = function(user, msg){
    if(user.mod && msg.length > 2) {
        // TODO: Mod actions
        if(msg[1] === "add"){

        } else if (msg[1] === "remove") {

        } else if (msg[1] === "edit") {

        }
    }

    if(msg.length < 2) {
        sendMessage("Invalid command usage.");
    } else {
        database.ref("blame/" + channel + "/" + msg[1]).once('value').then(function(snapshot){
            if(snapshot.val() === null){
                sendMessage("Can't blame " + msg[1] + ".");
            } else {
                var blame = snapshot.val();
                sendMessage(blame["message"].replace("#", blame["count"] + 1));
                database.ref("blame/" + channel + "/" + msg[1] + "/count").set(blame["count"] + 1);
            }
        });
    }
};

scope.RATE = function(user, msg){
    var thing = "";
    for (var i = 1, len = msg.length - 1; i < len; ++i) {
        thing += msg[i] + " ";
    }
    thing += msg[msg.length - 1];

    database.ref("ratings/" + channel + "/" + thing).once('value').then(function(snapshot){
        var rating = snapshot.val();
        var d = new Date();
        if(rating === null || rating["time"] < d){
            rating = {rating: Math.floor((Math.random() * 100)) / 10.0, time: d + 3600000};
        }
        sendMessage("I rate \'" + thing + "\' " + rating["rating"] + "/10");
        database.ref("ratings/" + channel + "/" + thing).update(rating);
    })
};

scope.BIRD = function(user, msg) {
    sendMessage(birdPuns.getBirdPun());
};

var convobot = new cleverbot(process.env.CLEVERBOT_KEY1, process.env.CLEVERBOT_KEY2);
convobot.setNick("CrippelChat");
convobot.create(function(err, session){
    //init stuff here?
});
scope.TALK = function(user, msg){
    if(msg.length > 1){
        var ask = "";
        for(var i = 1, len = msg.length - 1; i < len; ++i){
            ask += msg[i] + " ";
        }
        ask += msg[msg.length - 1];

        convobot.ask(ask, function(err, response){
            sendMessage(response);
        });
    }
};

scope.GIF = function(user, msg){
    if(msg.length > 1){
        var q = "";
        for(var i = 1, len = msg.length - 1; i < len; ++i){
            q += msg[i] + " ";
        }
        q += msg[msg.length - 1];
        giphy.search('gifs', {"q" : q, "limit" : 1}).then(function(response){
            sendMessage(response.data[0].images.original.gif_url);
        }).catch(function(err){
            console.error()
        });
    } else {
        giphy.random('gifs', {}).then(function(response){
            sendMessage(response.data.images.original.gif_url);
        }).catch(function(err){
            console.error()
        });
    }
};