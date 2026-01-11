# Quickstart

This quickstart demonstrates how to build a calculator agent using the LangGraph Graph API or the Functional API.

* [Use the Graph API](#use-the-graph-api) if you prefer to define your agent as a graph of nodes and edges.
* [Use the Functional API](#use-the-functional-api) if you prefer to define your agent as a single function.

For conceptual information, see [Graph API overview](/oss/javascript/langgraph/graph-api) and [Functional API overview](/oss/javascript/langgraph/functional-api).

<Info>
  For this example, you will need to set up a [Claude (Anthropic)](https://www.anthropic.com/) account and get an API key. Then, set the `ANTHROPIC_API_KEY` environment variable in your terminal.
</Info>

<Tabs>
  <Tab title="Use the Graph API">
    ## 1. Define tools and model

    In this example, we'll use the Claude Sonnet 4.5 model and define tools for addition, multiplication, and division.

    ```typescript  theme={null}
    import { ChatAnthropic } from "@langchain/anthropic";
    import { tool } from "@langchain/core/tools";
    import * as z from "zod";

    const model = new ChatAnthropic({
      model: "claude-sonnet-4-5-20250929",
      temperature: 0,
    });

    // Define tools
    const add = tool(({ a, b }) => a + b, {
      name: "add",
      description: "Add two numbers",
      schema: z.object({
        a: z.number().describe("First number"),
        b: z.number().describe("Second number"),
      }),
    });

    const multiply = tool(({ a, b }) => a * b, {
      name: "multiply",
      description: "Multiply two numbers",
      schema: z.object({
        a: z.number().describe("First number"),
        b: z.number().describe("Second number"),
      }),
    });

    const divide = tool(({ a, b }) => a / b, {
      name: "divide",
      description: "Divide two numbers",
      schema: z.object({
        a: z.number().describe("First number"),
        b: z.number().describe("Second number"),
      }),
    });

    // Augment the LLM with tools
    const toolsByName = {
      [add.name]: add,
      [multiply.name]: multiply,
      [divide.name]: divide,
    };
    const tools = Object.values(toolsByName);
    const modelWithTools = model.bindTools(tools);
    ```

    ## 2. Define state

    The graph's state is used to store the messages and the number of LLM calls.

    <Tip>
      State in LangGraph persists throughout the agent's execution.

      The `MessagesAnnotation` constant includes a built-in reducer for appending messages. The `llmCalls` field uses `(x, y) => x + y` to accumulate the count.
    </Tip>

    ```typescript  theme={null}
    import { StateGraph, START, END, MessagesAnnotation, Annotation } from "@langchain/langgraph";

    const MessagesState = Annotation.Root({
      ...MessagesAnnotation.spec,
      llmCalls: Annotation<number>({
        reducer: (x, y) => x + y,
        default: () => 0,
      }),
    });

    // Extract the state type for function signatures
    type MessagesStateType = typeof MessagesState.State;
    ```

    ## 3. Define model node

    The model node is used to call the LLM and decide whether to call a tool or not.

    ```typescript  theme={null}
    import { SystemMessage } from "@langchain/core/messages";
    async function llmCall(state: MessagesStateType) {
      return {
        messages: [await modelWithTools.invoke([
          new SystemMessage(
            "You are a helpful assistant tasked with performing arithmetic on a set of inputs."
          ),
          ...state.messages,
        ])],
        llmCalls: 1,
      };
    }
    ```

    ## 4. Define tool node

    The tool node is used to call the tools and return the results.

    ```typescript  theme={null}
    import { AIMessage, ToolMessage } from "@langchain/core/messages";
    async function toolNode(state: MessagesStateType) {
      const lastMessage = state.messages.at(-1);

      if (lastMessage == null || !AIMessage.isInstance(lastMessage)) {
        return { messages: [] };
      }

      const result: ToolMessage[] = [];
      for (const toolCall of lastMessage.tool_calls ?? []) {
        const tool = toolsByName[toolCall.name];
        const observation = await tool.invoke(toolCall);
        result.push(observation);
      }

      return { messages: result };
    }
    ```

    ## 5. Define end logic

    The conditional edge function is used to route to the tool node or end based upon whether the LLM made a tool call.

    ```typescript  theme={null}
    async function shouldContinue(state: MessagesStateType) {
      const lastMessage = state.messages.at(-1);

      // Check if it's an AIMessage before accessing tool_calls
      if (!lastMessage || !AIMessage.isInstance(lastMessage)) {
        return END;
      }

      // If the LLM makes a tool call, then perform an action
      if (lastMessage.tool_calls?.length) {
        return "toolNode";
      }

      // Otherwise, we stop (reply to the user)
      return END;
    }
    ```

    ## 6. Build and compile the agent

    The agent is built using the [`StateGraph`](https://reference.langchain.com/javascript/classes/_langchain_langgraph.index.StateGraph.html) class and compiled using the [`compile`](https://reference.langchain.com/javascript/classes/_langchain_langgraph.index.StateGraph.html#compile) method.

    ```typescript  theme={null}
    const agent = new StateGraph(MessagesState)
      .addNode("llmCall", llmCall)
      .addNode("toolNode", toolNode)
      .addEdge(START, "llmCall")
      .addConditionalEdges("llmCall", shouldContinue, ["toolNode", END])
      .addEdge("toolNode", "llmCall")
      .compile();

    // Invoke
    import { HumanMessage } from "@langchain/core/messages";
    const result = await agent.invoke({
      messages: [new HumanMessage("Add 3 and 4.")],
    });

    for (const message of result.messages) {
      console.log(`[${message.type}]: ${message.text}`);
    }
    ```

    <Tip>
      To learn how to trace your agent with LangSmith, see the [LangSmith documentation](/langsmith/trace-with-langgraph).
    </Tip>

    Congratulations! You've built your first agent using the LangGraph Graph API.

    <Accordion title="Full code example">
      ```typescript  theme={null}
      // Step 1: Define tools and model

      import { ChatAnthropic } from "@langchain/anthropic";
      import { tool } from "@langchain/core/tools";
      import * as z from "zod";

      const model = new ChatAnthropic({
        model: "claude-sonnet-4-5-20250929",
        temperature: 0,
      });

      // Define tools
      const add = tool(({ a, b }) => a + b, {
        name: "add",
        description: "Add two numbers",
        schema: z.object({
          a: z.number().describe("First number"),
          b: z.number().describe("Second number"),
        }),
      });

      const multiply = tool(({ a, b }) => a * b, {
        name: "multiply",
        description: "Multiply two numbers",
        schema: z.object({
          a: z.number().describe("First number"),
          b: z.number().describe("Second number"),
        }),
      });

      const divide = tool(({ a, b }) => a / b, {
        name: "divide",
        description: "Divide two numbers",
        schema: z.object({
          a: z.number().describe("First number"),
          b: z.number().describe("Second number"),
        }),
      });

      // Augment the LLM with tools
      const toolsByName = {
        [add.name]: add,
        [multiply.name]: multiply,
        [divide.name]: divide,
      };
      const tools = Object.values(toolsByName);
      const modelWithTools = model.bindTools(tools);

      // Step 2: Define state

      import { StateGraph, START, END, MessagesAnnotation, Annotation } from "@langchain/langgraph";

      const MessagesState = Annotation.Root({
        ...MessagesAnnotation.spec,
        llmCalls: Annotation<number>({
          reducer: (x, y) => x + y,
          default: () => 0,
        }),
      });

      // Extract the state type for function signatures
      type MessagesStateType = typeof MessagesState.State;

      // Step 3: Define model node

      import { SystemMessage } from "@langchain/core/messages";

      async function llmCall(state: MessagesStateType) {
        return {
          messages: [await modelWithTools.invoke([
            new SystemMessage(
              "You are a helpful assistant tasked with performing arithmetic on a set of inputs."
            ),
            ...state.messages,
          ])],
          llmCalls: 1,
        };
      }

      // Step 4: Define tool node

      import { AIMessage, ToolMessage } from "@langchain/core/messages";

      async function toolNode(state: MessagesStateType) {
        const lastMessage = state.messages.at(-1);

        if (lastMessage == null || !AIMessage.isInstance(lastMessage)) {
          return { messages: [] };
        }

        const result: ToolMessage[] = [];
        for (const toolCall of lastMessage.tool_calls ?? []) {
          const tool = toolsByName[toolCall.name];
          const observation = await tool.invoke(toolCall);
          result.push(observation);
        }

        return { messages: result };
      }

      // Step 5: Define logic to determine whether to end

      async function shouldContinue(state: MessagesStateType) {
        const lastMessage = state.messages.at(-1);

        // Check if it's an AIMessage before accessing tool_calls
        if (!lastMessage || !AIMessage.isInstance(lastMessage)) {
          return END;
        }

        // If the LLM makes a tool call, then perform an action
        if (lastMessage.tool_calls?.length) {
          return "toolNode";
        }

        // Otherwise, we stop (reply to the user)
        return END;
      }

      // Step 6: Build and compile the agent

      const agent = new StateGraph(MessagesState)
        .addNode("llmCall", llmCall)
        .addNode("toolNode", toolNode)
        .addEdge(START, "llmCall")
        .addConditionalEdges("llmCall", shouldContinue, ["toolNode", END])
        .addEdge("toolNode", "llmCall")
        .compile();

      // Invoke
      import { HumanMessage } from "@langchain/core/messages";
      const result = await agent.invoke({
        messages: [new HumanMessage("Add 3 and 4.")],
      });

      for (const message of result.messages) {
        console.log(`[${message.type}]: ${message.text}`);
      }
      ```
    </Accordion>
  </Tab>

  <Tab title="Use the Functional API">
    ## 1. Define tools and model

    In this example, we'll use the Claude Sonnet 4.5 model and define tools for addition, multiplication, and division.

    ```typescript  theme={null}
    import { ChatAnthropic } from "@langchain/anthropic";
    import { tool } from "@langchain/core/tools";
    import * as z from "zod";

    const model = new ChatAnthropic({
      model: "claude-sonnet-4-5-20250929",
      temperature: 0,
    });

    // Define tools
    const add = tool(({ a, b }) => a + b, {
      name: "add",
      description: "Add two numbers",
      schema: z.object({
        a: z.number().describe("First number"),
        b: z.number().describe("Second number"),
      }),
    });

    const multiply = tool(({ a, b }) => a * b, {
      name: "multiply",
      description: "Multiply two numbers",
      schema: z.object({
        a: z.number().describe("First number"),
        b: z.number().describe("Second number"),
      }),
    });

    const divide = tool(({ a, b }) => a / b, {
      name: "divide",
      description: "Divide two numbers",
      schema: z.object({
        a: z.number().describe("First number"),
        b: z.number().describe("Second number"),
      }),
    });

    // Augment the LLM with tools
    const toolsByName = {
      [add.name]: add,
      [multiply.name]: multiply,
      [divide.name]: divide,
    };
    const tools = Object.values(toolsByName);
    const modelWithTools = model.bindTools(tools);

    ```

    ## 2. Define model node

    The model node is used to call the LLM and decide whether to call a tool or not.

    ```typescript  theme={null}
    import { task, entrypoint } from "@langchain/langgraph";
    import { SystemMessage } from "@langchain/core/messages";
    const callLlm = task({ name: "callLlm" }, async (messages: BaseMessage[]) => {
      return modelWithTools.invoke([
        new SystemMessage(
          "You are a helpful assistant tasked with performing arithmetic on a set of inputs."
        ),
        ...messages,
      ]);
    });
    ```

    ## 3. Define tool node

    The tool node is used to call the tools and return the results.

    ```typescript  theme={null}
    import type { ToolCall } from "@langchain/core/messages/tool";
    const callTool = task({ name: "callTool" }, async (toolCall: ToolCall) => {
      const tool = toolsByName[toolCall.name];
      return tool.invoke(toolCall);
    });
    ```

    ## 4. Define agent

    ```typescript  theme={null}
    import { addMessages } from "@langchain/langgraph";
    import { type BaseMessage } from "@langchain/core/messages";

    const agent = entrypoint({ name: "agent" }, async (messages: BaseMessage[]) => {
      let modelResponse = await callLlm(messages);

      while (true) {
        if (!modelResponse.tool_calls?.length) {
          break;
        }

        // Execute tools
        const toolResults = await Promise.all(
          modelResponse.tool_calls.map((toolCall) => callTool(toolCall))
        );
        messages = addMessages(messages, [modelResponse, ...toolResults]);
        modelResponse = await callLlm(messages);
      }

      return messages;
    });

    // Invoke
    import { HumanMessage } from "@langchain/core/messages";

    const result = await agent.invoke([new HumanMessage("Add 3 and 4.")]);

    for (const message of result) {
      console.log(`[${message.getType()}]: ${message.text}`);
    }
    ```

    <Tip>
      To learn how to trace your agent with LangSmith, see the [LangSmith documentation](/langsmith/trace-with-langgraph).
    </Tip>

    Congratulations! You've built your first agent using the LangGraph Functional API.

    <Accordion title="Full code example" icon="code">
      ```typescript  theme={null}
      // Step 1: Define tools and model

      import { ChatAnthropic } from "@langchain/anthropic";
      import { tool } from "@langchain/core/tools";
      import * as z from "zod";

      const model = new ChatAnthropic({
        model: "claude-sonnet-4-5-20250929",
        temperature: 0,
      });

      // Define tools
      const add = tool(({ a, b }) => a + b, {
        name: "add",
        description: "Add two numbers",
        schema: z.object({
          a: z.number().describe("First number"),
          b: z.number().describe("Second number"),
        }),
      });

      const multiply = tool(({ a, b }) => a * b, {
        name: "multiply",
        description: "Multiply two numbers",
        schema: z.object({
          a: z.number().describe("First number"),
          b: z.number().describe("Second number"),
        }),
      });

      const divide = tool(({ a, b }) => a / b, {
        name: "divide",
        description: "Divide two numbers",
        schema: z.object({
          a: z.number().describe("First number"),
          b: z.number().describe("Second number"),
        }),
      });

      // Augment the LLM with tools
      const toolsByName = {
        [add.name]: add,
        [multiply.name]: multiply,
        [divide.name]: divide,
      };
      const tools = Object.values(toolsByName);
      const modelWithTools = model.bindTools(tools);

      // Step 2: Define model node

      import { task, entrypoint } from "@langchain/langgraph";
      import { SystemMessage } from "@langchain/core/messages";
      const callLlm = task({ name: "callLlm" }, async (messages: BaseMessage[]) => {
        return modelWithTools.invoke([
          new SystemMessage(
            "You are a helpful assistant tasked with performing arithmetic on a set of inputs."
          ),
          ...messages,
        ]);
      });

      // Step 3: Define tool node

      import type { ToolCall } from "@langchain/core/messages/tool";
      const callTool = task({ name: "callTool" }, async (toolCall: ToolCall) => {
        const tool = toolsByName[toolCall.name];
        return tool.invoke(toolCall);
      });

      // Step 4: Define agent
      import { addMessages } from "@langchain/langgraph";
      import { type BaseMessage } from "@langchain/core/messages";
      const agent = entrypoint({ name: "agent" }, async (messages: BaseMessage[]) => {
        let modelResponse = await callLlm(messages);

        while (true) {
          if (!modelResponse.tool_calls?.length) {
            break;
          }

          // Execute tools
          const toolResults = await Promise.all(
            modelResponse.tool_calls.map((toolCall) => callTool(toolCall))
          );
          messages = addMessages(messages, [modelResponse, ...toolResults]);
          modelResponse = await callLlm(messages);
        }

        return messages;
      });

      // Invoke
      import { HumanMessage } from "@langchain/core/messages";
      const result = await agent.invoke([new HumanMessage("Add 3 and 4.")]);

      for (const message of result) {
        console.log(`[${message.type}]: ${message.text}`);
      }
      ```
    </Accordion>
  </Tab>
</Tabs>

***

<Callout icon="pen-to-square" iconType="regular">
  [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/quickstart.mdx) or [file an issue](https://github.com/langchain-ai/docs/issues/new/choose).
</Callout>

<Tip icon="terminal" iconType="regular">
  [Connect these docs](/use-these-docs) to Claude, VSCode, and more via MCP for real-time answers.
</Tip>


---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://docs.langchain.com/llms.txt