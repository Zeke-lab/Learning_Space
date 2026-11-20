# Chapter 1: MCP (Model Context Protocol) အခြေခံသဘောတရားနှင့် Architecture

> **မသင်ယူမီ သိရှိရန်**
> - **ရည်ရွယ်ချက်** - MCP ၏ အဓိက ရည်ရွယ်ချက်၊ Host-Client-Server Architecture ၏ အလုပ်လုပ်ပုံနှင့် ခေတ်သစ် AI Application များတွင် ပါဝင်သည့် အခန်းကဏ္ဍကို အသေးစိတ် နားလည်သဘောပေါက်စေရန်။
> - **ခန့်မှန်းဖတ်ရှုချိန်** - မိနစ် ၄၅ မှ ၆၀ အထိ

---

## Part I - The Foundational Layer (အခြေခံ လိုအပ်ချက်များ)

ခေတ်သစ် AI Application များ သို့မဟုတ် Large Language Models (LLMs) များနှင့် ပြင်ပစနစ်များကို ချိတ်ဆက်သည့် စနစ်တစ်ခုကို မလေ့လာမီ၊ ကျွန်ုပ်တို့သည် Software Engineering ၏ အခြေခံ သဘောတရားအချို့ကို ပထမဦးစွာ ပြန်လည်ဆန်းစစ်ရန် လိုအပ်ပါသည်။ MCP (Model Context Protocol) ကို ကောင်းစွာ နားလည်နိုင်ရန်အတွက် အောက်ပါ အခြေခံသဘောတရား ၃ ခုကို ရှင်းလင်းစွာ သဘောပေါက်ထားရပါမည်။

### ၁။ API (Application Programming Interface)
**API (Application Programming Interface)** ဆိုသည်မှာ သီးခြား တည်ဆောက်ထားသော Software စနစ်နှစ်ခု သို့မဟုတ် မတူညီသော စနစ်များ အချင်းချင်း အချက်အလက်များ ဖလှယ်ရန်နှင့် လုပ်ဆောင်ချက်များ စေခိုင်းရန်အတွက် သတ်မှတ်ထားသော စည်းမျဉ်းစည်းကမ်း တံတား (Bridge) ဖြစ်သည်။

* **ဥပမာ ခိုင်းနှိုင်းချက်** - စားသောက်ဆိုင်တစ်ဆိုင်တွင် အစားအစာ စုဆောင်းချက်များ ရှိသော စားဖိုဆောင် (Server) နှင့် အစားအစာ လာရောက်စားသုံးသူ (Client) တို့ ရှိကြသည်။ စားသုံးသူသည် စားဖိုဆောင်ထဲသို့ တိုက်ရိုက်ဝင်ရောက်၍ ချက်ပြုတ်ခွင့်မရှိပါ။ ထိုနေရာတွင် စားပွဲထိုး (API) သည် စားသုံးသူ၏ မှာယူလိုသော Menu ကို ရယူကာ စားဖိုဆောင်သို့ ပေးပို့ပြီး၊ စားဖိုဆောင်မှ ထွက်ရှိလာသော အစားအစာကို စားသုံးသူထံ ပြန်လည်ပို့ဆောင်ပေးသည်။
* **အဘယ်ကြောင့် အရေးပါသနည်း** - AI Model တစ်ခုသည် မိမိ internal တွင် သိရှိထားသော အချက်အလက်များအပြင် ပြင်ပ Database၊ File System သို့မဟုတ် ရာသီဥတုစစ်ဆေးသည့် Web Service များနှင့် ချိတ်ဆက်ရန်အတွက် API များကို မဖြစ်မနေ အသုံးပြုရသည်။

### ၂။ JSON (JavaScript Object Notation) နှင့် JSON-RPC 2.0
**JSON** ဆိုသည်မှာ လူများ ဖတ်ရှုရန် လွယ်ကူပြီး ကွန်ပျူတာ စနစ်များက အလွယ်တကူ Parse (စိစစ်ခွဲခြား) နိုင်သော Data-interchange format (အချက်အလက် ပို့ဆောင်သည့် စံနှုန်း) ဖြစ်သည်။ key-value pairs များကို အခြေခံထားသည်။

**JSON-RPC 2.0** ဆိုသည်မှာ JSON ကို အခြေခံ၍ Remote Procedure Call (အဝေးရောက် Function ကို လှမ်းခေါ်ခြင်း) ပြုလုပ်ရန် သတ်မှတ်ထားသော သဘောတူညီချက် Protocol တစ်ခု ဖြစ်သည်။ MCP သည် စနစ်များအကြား သတင်းအချက်အလက် ပို့ဆောင်ရန်အတွက် ဤ JSON-RPC 2.0 Specification ကို အပြည့်အဝ အသုံးပြုထားသည်။

```json
{
  "jsonrpc": "2.0",
  "method": "subtract",
  "params": {"minuend": 42, "subtrahend": 23},
  "id": 1
}
```

* **အဘယ်ကြောင့် အရေးပါသနည်း** - MCP Server နှင့် Client တို့သည် တစ်ခုနှင့်တစ်ခု စကားပြောဆိုရာတွင် JSON-RPC format ဖြင့်သာ Request နှင့် Response ပေးပို့ကြမည်ဖြစ်သောကြောင့် ဖြစ်သည်။

### ၃။ Client-Server Architecture မော်ဒယ်
**Client-Server Architecture** ဆိုသည်မှာ တာဝန်များကို ပိုင်းခြားထားသော စနစ်ဖြစ်ပြီး၊ အချက်အလက် သို့မဟုတ် လုပ်ဆောင်ချက်ကို တောင်းဆိုသူကို **Client** ဟုခေါ်ပြီး၊ ထိုတောင်းဆိုချက်ကို လက်ခံဆောင်ရွက်၍ ပြန်လည်အကြောင်းပြန်ပေးသူကို **Server** ဟုခေါ်သည်။

* **အဘယ်ကြောင့် အရေးပါသနည်း** - MCP စနစ်တစ်ခုလုံးသည် ဤ မော်ဒယ်ကို အခြေခံထားပြီး၊ AI Application က Client အဖြစ် ဆောင်ရွက်ကာ စနစ်၏ လုပ်ဆောင်ချက်များကို ဖြန့်ကျက်ပေးထားသော သီးခြား Program များက Server အဖြစ် ဆောင်ရွက်ကြမည် ဖြစ်သည်။

---

## Part II - The Core Concept (အဓိက သဘောတရား)

### ၁။ MCP ဆိုသည်မှာ ဘာလဲ? (What and Why)

**MCP (Model Context Protocol)** ဆိုသည်မှာ Anthropic ကုမ္ပဏီမှ Open-source Standard အဖြစ် စတင်မိတ်ဆက်ခဲ့သော စံနှုန်းတစ်ခုဖြစ်ပြီး၊ AI Model များ (ဥပမာ- Claude, GPT-4) နှင့် Local သို့မဟုတ် Remote တွင်ရှိသော Context Source များ (Database များ၊ File System များ၊ Enterprise API များ) အကြား ချိတ်ဆက်မှုကို တစ်ပြေးညီ စံနှုန်းတစ်ခုတည်းဖြင့် တည်ဆောက်နိုင်ရန် ပြုလုပ်ထားသော Protocol ဖြစ်သည်။

#### ခေတ်သစ် AI Integration ၏ ပြဿနာ (The M x N Problem)
MCP မပေါ်ပေါက်မီ ကာလက AI Application များတွင် ပြင်ပ Data Source များကို ချိတ်ဆက်ရာ၌ ဘက်ပေါင်းစုံ အခက်အခဲ (Complexity) ရှိခဲ့ပါသည်။
* Claude App အတွက် Postgres Database Connector သီးခြားရေးရသည်။
* VS Code AI Extension အတွက် Postgres Database Connector သီးခြား ထပ်မံရေးရသည်။
* Custom Agent အတွက် Postgres Database Connector ပြန်ရေးရသည်။

အကယ်၍ AI Host Application မျိုးစုံ ($M$) အား ပြင်ပ Data Source / Tool မျိုးစုံ ($N$) များနှင့် ချိတ်ဆက်လိုပါက Integrations စာရင်းသည် $M \times N$ ခုအထိ ရှုပ်ထွေးများပြားလာပါသည်။

```
[ traditional M x N Architecture ]

  AI Client A ---
  AI Client B ----+---> Postgres, GitHub, Local Files (Custom code per client)
  AI Client C ---

[ Modern MCP Standard Architecture ]

  AI Client A ---
  AI Client B ----+---> [ MCP Protocol ] ---> MCP Server (Postgres, GitHub, Local Files)
  AI Client C ---
```

**MCP ၏ ဖြေရှင်းချက်** - MCP သည် USB-C Standard ကဲ့သို့ လုပ်ဆောင်ပါသည်။ ကွန်ပျူတာ အမျိုးအစားမျိုးစုံနှင့် Device အမျိုးအစားမျိုးစုံကို USB-C Port တစ်ခုတည်းဖြင့် ချိတ်ဆက်နိုင်သကဲ့သို့၊ AI Application တိုင်းသည် MCP Protocol ကို အကောင်အထည်ဖော်ထားပါက၊ မည်သည့် MCP Server ကိုမဆို ချက်ချင်း တိုက်ရိုက်ချိတ်ဆက် အသုံးပြုနိုင်သွားမည် ဖြစ်သည်။

---

### ၂။ Host, Client နှင့် Server သုံးခု၏ ဆက်သွယ်မှုနှင့် အခန်းကဏ္ဍများ

MCP ၏ Architecture ကို အဓိက အစိတ်အပိုင်း ၃ ခုဖြင့် ဖွဲ့စည်းထားပါသည်။ ထို ၃ ခု၏ တာဝန်နှင့် အလုပ်လုပ်ပုံကို ရှင်းလင်းစွာ ခွဲခြားနားလည်ရပါမည်။

```
+-------------------------------------------------------------------------+
|                                 HOST                                    |
|  (e.g., Claude Desktop / VS Code Extension / Custom Agent App)          |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  |                           MCP CLIENT                              |  |
|  |                                                                   |  |
|  |   - Initiates connections                                         |  |
|  |   - Negotiates protocol capabilities                              |  |
|  |   - Translates Host intents to JSON-RPC requests                  |  |
|  +-------------------------------------------------------------------+  |
+-----------------------------------|-------------------------------------+
                                    |
                 Transport Layer    |  (Stdio or SSE)
                                    |
+-----------------------------------|-------------------------------------+
|                                   v                                     |
|                           MCP SERVER                                    |
|                                                                         |
|  - Exposes Resources (Read-only data)                                   |
|  - Exposes Tools (Executable actions)                                   |
|  - Exposes Prompts (Reusable interaction templates)                     |
+-------------------------------------------------------------------------+
```

#### (က) Host (အိမ်ရှင် စနစ်)
* **အဓိပ္ပာယ်** - သုံးစွဲသူနှင့် တိုက်ရိုက် ထိတွေ့နေသော AI Application ပတ်ဝန်းကျင် ဖြစ်သည်။ (ဥပမာ - Claude Desktop App, VS Code မကိန်းဂဏန်း AI Assistant, သို့မဟုတ် Python ဖြင့် ရေးသားထားသော Agent Framework)
* **တာဝန်** - AI Model (LLM) ကို ကိုင်တွယ်စရာမလိုဘဲ အသုံးပြုသူ၏ Input ကို လက်ခံသည်။ MCP Client Instance များကို သက်တမ်းအလိုက် စီမံခန့်ခွဲသည် (Lifecycle management)။ Security Permission များကို သုံးစွဲသူထံမှ တောင်းဆိုပေးသည်။

#### (ခ) Client (မေတ္တာရပ်ခံသူ)
* **အဓိပ္ပာယ်** - Host Application ၏ တွင်းထဲတွင် စိုက်ထူထားသော MCP Protocol ၏ ချိတ်ဆက်ရေး ခေါင်းစီးအစိတ်အပိုင်း ဖြစ်သည်။
* **တာဝန်** - Server တစ်ခုချင်းစီနှင့် 1-to-1 Connection ကို တည်ဆောက်သည်။ Capability Negotiation (မည်သည့် Feature များ အပြန်အလှန် ပံ့ပိုးသလဲ စစ်ဆေးခြင်း) ပြုလုပ်သည်။ LLM ၏ တောင်းဆိုချက်အရ MCP Server ထံသို့ JSON-RPC Format ဖြင့် Request များကို ဖြန့်ဝေသည်။

#### (ဂ) Server (ဝန်ဆောင်မှု ပေးသူ)
* **အဓိပ္ပာယ်** - သီးခြား သီးသန့် အလုပ်လုပ်နေသော Process သို့မဟုတ် Remote Service ဖြစ်ပြီး သီးခြား Data Source သို့မဟုတ် Tool အစုအဝေးကို ပိုင်ဆိုင်ထားသည်။
* **တာဝန်** - ၎င်း၏ စွမ်းဆောင်ရည်များ (Resources, Tools, Prompts) ကို MCP Client ထံသို့ စံနှုန်းအတိုင်း ထုတ်ဖော်ပြသသည် (Expose ပြုလုပ်သည်)။ Client ထံမှ လာသော စေခိုင်းချက်များကို လုံခြုံစွာ ဆောင်ရွက်ပေးသည်။

---

### ၃။ Key Takeaways သုံးခု
1. **Standardization (စံနှုန်းတစ်ခုတည်းဖြစ်ခြင်း)**: MCP သည် LLM များနှင့် Data Source များအကြား Integrations မြောက်မြားစွာ ရေးသားရသည့် ဒုက္ခကို ဖြေရှင်းပေးသည်။
2. **Security & Boundaries (လုံခြုံရေး ဧရိယာ စိုင်းထူခြင်း)**: Host နှင့် Server သည် အပြန်အလှန် ပိုင်းခြားထားသော Process များဖြစ်သဖြင့် Data access ကို သုံးစွဲသူ ခွင့်ပြုချက်ဖြင့်သာ ဆောင်ရွက်နိုင်သည်။
3. **Flexibility (ပြောင်းလွယ်ပြင်လွယ်ရှိခြင်း)**: Server တစ်ခုတည်းကို ရေးသားထားရုံဖြင့် Claude, Cursor, လာမည့် ခေတ်မှီ AI Host များတွင် ပြန်လည်ပြင်ဆင်စရာမလိုဘဲ တိုက်ရိုက် ချက်ချင်း တပ်ဆင် သုံးစွဲနိုင်သည်။

---

## Part III - Practical Code / Real-World Example

MCP Specification ကို ပိုမို လက်တွေ့ကျကျ နားလည်ရန်အတွက် Server တစ်ခုနှင့် Client အကြား ဖလှယ်သော Core Primitives များ၊ Transport Mechanism များ၊ နှင့် JSON-RPC Message Protocol Flow ကို လက်တွေ့ သုံးသပ်ကြည့်ပါမည်။

### ၁။ MCP ၏ Core Primitives သုံးခု

MCP Server တစ်ခုသည် ၎င်း၏ အချက်အလက်များကို အောက်ပါ Primary Primitives ၃ ခုဖြင့် မော်ဒယ် ပြုလုပ်ထားပါသည်။

| Primitive | ဦးတည်ချက် | သဘောတရား | ဥပမာ | Action Type |
| :--- | :--- | :--- | :--- | :--- |
| **Resources** | Data ရယူရန် | Server ထံမှ ဖတ်ရှုနိုင်သော အချက်အလက် သို့မဟုတ် File Content များ (Read-only data) | Log file များ၊ Database Record များ၊ API Document များ | Passive (ဖတ်ရှုရုံ)
| **Tools** | Action လုပ်ဆောင်ရန် | AI Model က လှမ်းခေါ် စေခိုင်းနိုင်သော Function များ (Executable functions) | Email ပို့ခြင်း၊ Database ထဲ အချက်အလက်သစ် ရေးသားခြင်း၊ Code run ခြင်း | Active (လုပ်ဆောင်ချက်ပါဝင်)
| **Prompts** | Context ပုံစံသွင်းရန် | Server မှ ကြိုတင် ပြင်ဆင်ပေးထားသော စံပြ Prompt Template များ | Bug fixing prompt template, Code review standard guidance | Structural (လမ်းညွှန်ချက်)

---

### ၂။ Transport Mechanisms များ: Stdio နှင့် SSE

MCP သည် Client နှင့် Server အကြား Message များ ပေးပို့ရန်အတွက် အောက်ပါ Transport Mechanism ၂ ခုကို သတ်မှတ်ထားသည်။

#### (က) Stdio (Standard Input / Output) Transport
* **အလုပ်လုပ်ပုံ** - Host သည် MCP Server Process ကို Local ကွန်ပျူတာပေါ်တွင် Child Process အဖြစ် စတင်မောင်းနှင်သည် (Spawn လုပ်သည်)။ ထို့နောက် Standard Input (`stdin`) နှင့် Standard Output (`stdout`) တို့ကို အသုံးပြု၍ JSON Message များကို အပြန်အလှန် ဖလှယ်ကြသည်။
* **အသုံးပြုသည့် ပတ်ဝန်းကျင်** - Local Desktop App များ (ဥပမာ- Claude Desktop ဖြင့် Local Python/TypeScript Server ချိတ်ဆက်ခြင်း)။
* **အားသာချက်** - Network setup မလိုခြင်း၊ အလွန် မြန်ဆန်ခြင်း၊ လုံခြုံမှု အပြည့်အဝ ရှိခြင်း။

#### (ခ) SSE (Server-Sent Events) Transport
* **အလုပ်လုပ်ပုံ** - Server သည် HTTP Server အဖြစ် သီးခြား Run နေသည်။ Client သည် Server သို့ HTTP Request ပေးပို့၍ SSE Connection ဖွင့်လှစ်သည်။ Server ထံမှ Event များကို Stream စနစ်ဖြင့် ပြန်လည် ရယူကာ၊ တောင်းဆိုချက်များကို HTTP POST ဖြင့် ပေးပို့သည်။
* **အသုံးပြုသည့် ပတ်ဝန်းကျင်** - Cloud တွင် လွှင့်တင်ထားသော Remote MCP Server များ၊ အဖွဲ့အစည်းတွင်း သီးခြား server တွင် run ထားသော Microservices များ။
* **အားသာချက်** - Remote Access ရရှိခြင်း၊ Microservice Architecture များနှင့် အလွယ်တကူ တပေါင်းတစည်းတည်း လုပ်ဆောင်နိုင်ခြင်း။

---

### ၃။ JSON-RPC 2.0 Protocol Trace လက်တွေ့လေ့လာခြင်း

ယခုအခါ MCP Client ( Host ၏ တွင်းပိုင်း) နှင့် MCP Server တို့ တိုက်ရိုက် ဆက်သွယ်စကားပြောသော **Protocol Handshake နှင့် Message Flow** ကို အဆင့်လိုက် ကြည့်ရှုပါမည်။ (ဤသည်မှာ Specification v1.0 အရ လက်တွေ့ ဖြတ်သန်းသော Stream JSON Structure ဖြစ်သည်)

#### Step 1: Handshake and Initialization (`initialize` Request)
Client စတင် ပွင့်လာသည်နှင့် Server သို့ Protocol Version နှင့် ၎င်း၏ Capability များကို ပို့ဆောင်သည်။

**Client -> Server Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "roots": {
        "listChanged": true
      },
      "sampling": {}
    },
    "clientInfo": {
      "name": "Claude Desktop Tool",
      "version": "1.0.0"
    }
  }
}
```

**Server -> Client Response:**
Server သည် မိမိ ပံ့ပိုးပေးနိုင်သော Primitive များပါဝင်သည့် Capability ကို ပြန်လည် အကြောင်းပြန်သည်။
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": {
        "listChanged": true
      },
      "resources": {}
    },
    "serverInfo": {
      "name": "My-First-MCP-Server",
      "version": "1.0.0"
    }
  }
}
```

**Client Notification Confirmation:**
Client က ထပ်မံ၍ အဆင်သင့်ဖြစ်ကြောင်း `notifications/initialized` ကို ပို့ဆောင်သည်။
```json
{
  "jsonrpc": "2.0",
  "method": "notifications/initialized"
}
```

---

#### Step 2: Listing Tools (`tools/list` Request)
Host Application သည် Server တွင် မည်သည့် Tool များ ရရှိနိုင်သနည်းဟု မေးမြန်းသည်။

**Client -> Server Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}
```

**Server -> Client Response:**
Server က ၎င်းပိုင်ဆိုင်သော Tool အမည်၊ ဖော်ပြချက်နှင့် Input Parameter Format (JSON Schema) ကို အကြောင်းပြန်သည်။
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "calculate_sum",
        "description": "ဂဏန်းနှစ်ခု ပေါင်းလဒ်ကို တွက်ချက်ပေးသော Tool ဖြစ်သည်",
        "inputSchema": {
          "type": "object",
          "properties": {
            "a": { "type": "number", "description": "ပထမ ဂဏန်း" },
            "b": { "type": "number", "description": "ဒုတိယ ဂဏန်း" }
          },
          "required": ["a", "b"]
        }
      }
    ]
  }
}
```

---

#### Step 3: Calling a Tool (`tools/call` Request)
LLM က တွက်ချက်မှု လုပ်ဆောင်ရန် ဆုံးဖြတ်လိုက်သောအခါ Host သည် Server ၏ Tool ကို လှမ်းယူ စေခိုင်းသည်။

**Client -> Server Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "calculate_sum",
    "arguments": {
      "a": 15,
      "b": 25
    }
  }
}
```

**Server -> Client Response:**
Server သည် Function ကို Run ပြီး ရလဒ်ကို Text Content အဖြစ် တုံ့ပြန်ပေးလိုက်သည်။
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "ပေါင်းလဒ် ရလဒ်မှာ 40 ဖြစ်ပါသည်။"
      }
    ],
    "isError": false
  }
}
```

---

## Part IV - Recap & Next Chapter Preview

### အခန်း၏ အနှစ်ချုပ် (Summary)

* **MCP ၏ အဓိက ရည်ရွယ်ချက်** - LLM များနှင့် ပြင်ပ Data/Tools များအကြား $M \times N$ ရှုပ်ထွေးမှုကို $1 \times N$ Open Standard အဖြစ် ပြောင်းလဲပေးလိုက်ခြင်းဖြစ်သည်။
* **Architecture အစိတ်အပိုင်း ၃ ခု**:
  1. **Host**: သုံးစွဲသူနှင့် တိုက်ရိုက် ထိတွေ့ပြီး Server များကို စီမံပေးသော AI App (e.g., Claude Desktop).
  2. **Client**: Protocol အရ အပြန်အလှန် ချိတ်ဆက်ပေးသော Host အတွင်းရှိ Connector Component.
  3. **Server**: Resources, Tools, Prompts များကို ပေးအပ်ထားသော သီးခြား Service Process.
* **Core Primitives** - Read-only ဖတ်ရှုရန် **Resources**၊ Execute လုပ်ဆောင်ရန် **Tools**၊ Standardized Input တည်ဆောက်ရန် **Prompts** များ ပါဝင်သည်။
* **Transports** - Local Process များအတွက် **Stdio** ကို အသုံးပြုပြီး၊ Remote Network ချိတ်ဆက်မှုများအတွက် **SSE** ကို အသုံးပြုသည်။
* **Protocol Backbone** - အပြန်အလှန် ပို့ဆောင်မှုအားလုံးကို **JSON-RPC 2.0** Specification ဖြင့် ဆောင်ရွက်သည်။

---

### Next Chapter Preview (နောက်အခန်း လမ်းညွှန်)

နောက်အခန်း (Chapter 2) တွင် **"Development Environment ပြင်ဆင်ခြင်းနှင့် ပထမဦးဆုံး MCP Server တည်ဆောက်ခြင်း"** ကို လက်တွေ့ လေ့လာကြပါမည်။

ထိုအခန်းတွင် မည်သည့် ကိရိယာများ ပါဝင်မည်နည်း-
* Node.js / TypeScript များနှင့် Python ပတ်ဝန်းကျင်ကို MCP Development အတွက် စနစ်တကျ ပြင်ဆင်ခြင်း။
* Official `@modelcontextprotocol/sdk` ကို အသုံးပြု၍ ပထမဦးဆုံး သီးသန့် MCP Server (Hello World Server) ကို အစအဆုံး ရေးသားခြင်း။
* ရေးသားထားသော Server ကို Claude Desktop သို့မဟုတ် Inspector Tool များဖြင့် စမ်းသပ် ကိန်းဂဏန်းထုတ်ယူခြင်း။
