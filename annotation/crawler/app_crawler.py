import gradio as gr
import subprocess
import os

def run_crawler_script(query: str, num_images: float, prefix: str):
    """
    Runs the crawler.py script with the given parameters and MinIO environment variables.
    """
    # Set environment variables for the subprocess, mirroring run_crawler.sh
    env_vars = os.environ.copy()
    env_vars["MINIO_ENDPOINT"] = "http://0.0.0.0:9000"
    env_vars["MINIO_ACCESS_KEY"] = "minioadmin"
    env_vars["MINIO_SECRET_KEY"] = "minioadmin"
    env_vars["MINIO_BUCKET"] = "iva"

    # Determine the path to crawler.py
    # Assumes app_crawler.py and crawler.py are in the same directory
    current_script_dir = os.path.dirname(os.path.abspath(__file__))
    crawler_py_path = os.path.join(current_script_dir, "crawler.py")

    # Ensure num_images is an integer for the script argument
    try:
        num_images_int = int(num_images)
    except ValueError:
        return "Error: 'Number of Images' must be a whole number."

    command = [
        "python", crawler_py_path,
        "--query", query,
        "--num-image", str(num_images_int),
        "--prefix", prefix
    ]

    try:
        # Execute the command
        # Using cwd=current_script_dir can be helpful if crawler.py uses relative paths
        process = subprocess.run(
            command,
            env=env_vars,
            capture_output=True,
            text=True,
            check=False, # We'll check returncode manually
            cwd=current_script_dir
        )
        
        output_log = f"Executing command: {' '.join(command)}\n\n"
        if process.stdout:
            output_log += f"STDOUT:\n{process.stdout}\n"
        if process.stderr:
            output_log += f"STDERR:\n{process.stderr}\n"
        output_log += f"Return Code: {process.returncode}"
        
        return output_log

    except FileNotFoundError:
        return f"Error: The script '{crawler_py_path}' was not found. Make sure it's in the same directory as this Gradio app ({current_script_dir})."
    except Exception as e:
        return f"An unexpected error occurred while trying to run the crawler: {str(e)}"

# Define Gradio interface components
query_input = gr.Textbox(label="Search Query", value="people using weapons", info="The query to search for images.")
num_images_input = gr.Number(label="Number of Images", value=200, precision=0, info="How many images to attempt to download.")
prefix_input = gr.Textbox(label="MinIO Prefix", value="weapons/", info="The prefix (folder path) in the MinIO bucket where images will be stored (e.g., 'weapons/').")

output_log_display = gr.Textbox(label="Crawler Output Log", lines=20, autoscroll=True)

iface = gr.Interface(
    fn=run_crawler_script,
    inputs=[query_input, num_images_input, prefix_input],
    outputs=output_log_display,
    title="Image Crawler Control Panel",
    description="Interface to run `crawler.py`. Configure the parameters below and click 'Submit'. The script's output and status will appear in the log.",
    allow_flagging="never"
)

if __name__ == "__main__":
    print("Starting Gradio app for Image Crawler...")
    # Launch the Gradio app, making it accessible on the network
    iface.launch(server_name="0.0.0.0", server_port=7862) # Using port 7862 to avoid conflict with Label Studio (7861)