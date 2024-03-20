# mind-goblin
Your friendly internet enabled assistant. Swap minds with custom prompts and Ollama

## Approach

- Uses [fc-dolphin-2.6-mistral-7b-dpo-laser](https://huggingface.co/cognitivecomputations/fc-dolphin-2.6-mistral-7b-dpo-laser) trained on [glaive-function-calling-v2](https://huggingface.co/datasets/glaiveai/glaive-function-calling-v2)
- Runs model with [Ollama](https://ollama.com/)
- Exposes a `search_wikipedia` function in the system prompt
- Listens for function call from model and injects result back in
- Gets model to respond using function results