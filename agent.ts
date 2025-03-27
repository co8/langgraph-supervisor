// Langgraph Supervisor managing specialized agents
//https://github.com/langchain-ai/langgraphjs/tree/main/libs/langgraph-supervisor

// load env variables
import * as dotenv from "dotenv";
dotenv.config();

process.env.TAVILY_API_KEY;
process.env.LANGSMITH_PROJECT;
process.env.LANGSMITH_API_KEY;
process.env.LANGSMITH_TRACING;
process.env.LANGSMITH_ENDPOINT;

//import { ChatOpenAI } from "@langchain/openai";
import { ChatOllama } from "@langchain/ollama";
import { createSupervisor } from "@langchain/langgraph-supervisor";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver, InMemoryStore } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

// Memory
const checkpointer = new MemorySaver();
const store = new InMemoryStore();

/////////////////////////
// DEV Variables
const stateThreadId = "751786846877";
/////////////////////////

//const model = new ChatOpenAI({ modelName: "gpt-4o" });
const model = new ChatOllama({
  model: "mistral-small",
  //model: "llama3.2:3b",
  temperature: 0,
  //verbose: true,
});

// Create specialized agents
const add = tool(async (args) => args.a + args.b, {
  name: "add",
  description: "Add two numbers.",
  schema: z.object({
    a: z.number(),
    b: z.number(),
  }),
});

const multiply = tool(async (args) => args.a * args.b, {
  name: "multiply",
  description: "Multiply two numbers.",
  schema: z.object({
    a: z.number(),
    b: z.number(),
  }),
});

const webSearch = tool(
  async (args) => {
    return (
      "Here are the headcounts for each of the FAANG companies in 2024:\n" +
      "1. **Facebook (Meta)**: 67,317 employees.\n" +
      "2. **Apple**: 164,000 employees.\n" +
      "3. **Amazon**: 1,551,000 employees.\n" +
      "4. **Netflix**: 14,000 employees.\n" +
      "5. **Google (Alphabet)**: 181,269 employees."
    );
  },
  {
    name: "web_search",
    description: "Search the web for information.",
    schema: z.object({
      query: z.string(),
    }),
  }
);

const mathAgent = createReactAgent({
  llm: model,
  tools: [add, multiply],
  name: "math_expert",
  prompt: "You are a math expert. Always use one tool at a time.",
});

const researchAgent = createReactAgent({
  llm: model,
  tools: [webSearch],
  name: "research_expert",
  prompt:
    "You are a world class researcher with access to web search. Do not do any math.",
});

// Create supervisor workflow
const workflow = createSupervisor({
  agents: [researchAgent, mathAgent],
  llm: model,
  prompt:
    "You are a team supervisor managing a research expert and a math expert. " +
    "For current events, use research_agent. " +
    "For math problems, use math_agent.",
  outputMode: "full_history", //"last_message"
});

// Compile and run
//const app = workflow.compile(); // no memory
const app = workflow.compile({
  checkpointer,
  store,
});
const result = await app.invoke(
  {
    messages: [
      {
        role: "user",
        content:
          "what's the combined headcount of the FAANG companies in 2024??",
      },
    ],
  },
  { configurable: { thread_id: stateThreadId } }
);

console.log(result.messages[result.messages.length - 1].content + "\n");
