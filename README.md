# mind-goblin
Your friendly internet enabled assistant. Swap minds with custom prompts and Ollama

## Approach

- Runs a model trained on function calling
- Exposes a `search_wikipedia` function in the system prompt
- Listens for function call from model and injects result back in
- Gets model to respond using function results

## Running

- Set up Node.js 19.x or later.
- Download a copy of [NousResearch/Hermes-2-Pro-Mistral-7B](https://huggingface.co/NousResearch/Hermes-2-Pro-Mistral-7B). Prefer the 7B Q4_K_M model if possible
- Compile and run the [lamma.cpp example server](https://github.com/ggerganov/llama.cpp/blob/master/examples/server/README.md). (You may wish to compile with GPU support for your particular hardware setup)
- Run the server with the following args:
```
./server --model /path/to/Hermes-2-Pro-Mistral-7B.Q4_K_M.gguf
```
- Run the mind goblin repl: `node index.js`
- Ask the mind goblin to do stuff for you