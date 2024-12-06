const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs'); 
const jsonFile = require('./data/messages.json');
const blacklistFile = require('./data/blacklist.json');
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});
var scraping = false;
const quoteChannelID = 1234;
const adminChannelID = 5678;

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});



//Scrape command to scrape the entire channel for usable quotes
client.on('messageCreate', async (message) => {
    scraping = true;
    if (message.content.startsWith('!scrape') && 
        message.channelId == adminChannelID) {
        const channelId = quoteChannelID;
        const messages = await scrapeMessages(channelId);

        //Message save
        saveScrapedMessagesToFile(messages, 'messages.json');

        message.reply("Successfully scraped " + messages.length + " messages");
    }
    scraping = false;
});

//Admin/Test commands
client.on('messageCreate', (message) => {
    //If we are in the process of scraping, we just ignore this 
    //Ignore messages from the bot itself
    //ignore messages not made in the designated admin channel
    //ignore messages not made by admins
    if (scraping ||
        message.author.bot ||
        message.channelId != adminChannelID
    ) return;

    //Adds a message to the quotes blacklist
    if (message.content.startsWith("!IgnoreMOTD")){
        
        let cont = message.content.split("!IgnoreMOTD ")[1];
        if (/[a-z]/i.test(cont)){
            message.reply("Invalid message ID");
            return;
        } 
        blacklistFile.push(cont);
        saveMessagesToFile(blacklistFile, "blacklist.json");
        blacklistAMessage(cont);
        message.reply("Successfully blacklisted messageID: \n```" + cont+"```");
    }
    
    //Fetch a random quote from the list (Test command)
    if (message.content === "!RandomMOTD"){
        message.reply(`${fetchRandomMessage().content}`)
    }
    
    //PURELY FOR API TESTING
    if(message.content === "!test"){
        message.reply(message);
    }
});

//parses new incoming quotes
client.on('messageCreate', (message) => {
    //If we are in the process of scraping, we just ignore this 
    //Ignore messages from the bot itself
    //ignore messages not made in the designated quotes channel
    if (scraping ||
        message.author.bot ||
        message.channelId != quoteChannelID
    ) return;

    //Parse a new quote
    if(message.content.indexOf("!")!==0){
        if (message.content.match(new RegExp("\"", "g")).length >= 2) {
            jsonFile.push({content: message.content, id: message.id});
            saveMessagesToFile(jsonFile, "messages.json");
            //console.log(`${message.content}\n${message.id}`);
        }
    }
});

//Removes a message from the messages.json file
function blacklistAMessage(toBlacklist){
    jsonFile.forEach((msg)=> {
        if(msg.id === toBlacklist){
            jsonFile.splice(jsonFile.indexOf(msg), 1);
            saveMessagesToFile(jsonFile, "messages.json");
        }
    });
}



//Gets a random message from the JSON File
function fetchRandomMessage(){
    const randomIndex = Math.floor((Math.random()*jsonFile[0]-1)+1);
    //console.log(`${randomIndex}, ${jsonFile[randomIndex]}`)
    return jsonFile[randomIndex];
}


async function scrapeMessages(channelId) {
    const channel = await client.channels.fetch(channelId);

    if (!channel.isTextBased()) {
        console.error('Channel is not a text-based channel.');
        return;
    }

    let messages = [];
    let lastMessageId = null;

    while (true) {
        // Fetch messages in batches of up to 100
        const fetchedMessages = await channel.messages.fetch({
            limit: 100,
            before: lastMessageId
        });

        // Add the fetched messages to the array
        messages.push(...fetchedMessages.values());

        // Break if no more messages are available
        if (fetchedMessages.size === 0) {
            break;
        }

        // Update lastMessageId to paginate
        lastMessageId = fetchedMessages.last().id;
    }
    return messages;
}

function saveScrapedMessagesToFile(messages, fileName) {
    let data = messages
    .filter((msg)=>(
        !blacklistFile.includes(msg.id)
    )).filter((msg)=>(
        !msg.author.bot
    )).filter((msg)=>(
        msg.content.match(new RegExp("\"", "g"))
    ))
    .map((msg) => ({
        content: msg.content,
        id: msg.id
    }));

    data = [data.length].concat(data);
    fs.writeFileSync("./data/"+fileName, JSON.stringify(data, null, 2));
    console.log(`Messages saved to ${fileName}, ${data.length} messages saved`);
}

function saveMessagesToFile(messages, fileName){
    messages[0] = messages.length;
    fs.writeFileSync("./data/"+fileName, JSON.stringify(messages, null, 2));
    //console.log("Saved");
}

// Log in to Discord with bot token
client.login();

