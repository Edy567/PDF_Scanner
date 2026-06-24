
### Prerequisites
- [Docker](https://www.docker.com/products/docker-desktop/) installed and running.
- [Ollama](https://ollama.com/) installed and running on your local machine.

### 1. Configure Ollama
By default, Ollama blocks external network requests. To allow the Docker containers to talk to your local Ollama models, you must expose it:
* **Windows:** Add a new System Environment Variable named `OLLAMA_HOST` with the value `0.0.0.0`. Restart the Ollama app completely from the system tray.
* **Mac/Linux:** Run `OLLAMA_HOST="0.0.0.0" ollama serve` in your terminal.

### Security Note: Locking Down Ollama (Optional but Recommended)

By default, setting `OLLAMA_HOST="0.0.0.0"` exposes your local Ollama instance to your entire local network (e.g., anyone on the same public Wi-Fi). If you are working on a public network and want to secure your setup, bind Ollama strictly to Docker's internal virtual network instead:

1. Open your Windows terminal and run:
   ```bash
   ipconfig
   ```
2. Locate the adapter used by Docker (usually named **Ethernet adapter vEthernet (WSL)** or **DockerNAT**).
3. Copy the **IPv4 Address** of that adapter (e.g., `172.19.x.x` or `192.168.x.x`).
4. Set your `OLLAMA_HOST` System Environment Variable to that exact IP address instead of `0.0.0.0`.
5. Completely restart the Ollama app from the Windows system tray.

*Note: Because Windows dynamically assigns this virtual IP, you may need to update your `OLLAMA_HOST` variable if your computer restarts and the IP changes.*

### 2. Build and Start the Containers
Open your terminal in the root directory (where the `docker-compose.yml` file is located) and run:

```bash
docker compose up --build
