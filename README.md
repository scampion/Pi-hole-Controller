# Pi-hole Controller

A simple web interface to temporarily disable Pi-hole blocking for specific domains based on tags in their comments.

## Features

-   **Login Screen:** Securely access the controls with your Pi-hole password.
-   **Tag-Based Control:** Automatically finds domains with `#tags` (e.g., `#social`, `#news`) in their comments.
-   **Timed Unblocking:** Select a tag and a duration (5, 10, 20, or 45 minutes) to temporarily disable all associated domains.
-   **Automatic Re-blocking:** The server automatically re-enables the domains after the timer expires.
-   **Log Out:** Securely end your session.

## Technology

-   **Backend:** Python 3 with Flask
-   **Frontend:** HTML, CSS, and vanilla JavaScript
-   **Dependencies:** `requests`, `python-dotenv`

## Setup

1.  **Prerequisites:**
    Make sure you have Python 3 and `pip` installed.

2.  **Install Dependencies:**
    Run the following command in the project directory:
    ```bash
    pip install -r requirements.txt
    ```

3.  **Configure Environment Variables:**
    Create a file named `.env` in the project root and add your Pi-hole's URL and password. You can also add a custom secret key for the session.
    ```ini
    # Pi-hole configuration
    PIHOLE_URL=http://pi.hole
    PIHOLE_PASSWORD=your_password_here

    # A long, random string for securing the user session
    SECRET_KEY=change-this-to-something-secret
    ```

4.  **Add Tags to Pi-hole Domains:**
    In your Pi-hole admin interface, go to **Domains**. For each domain you want to control, add one or more `#tags` to its "Comment" field. The application will group domains by these tags.

## Running the Application

1.  **Start the Server:**
    ```bash
    python server.py
    ```

2.  **Access the Web Interface:**
    Open your web browser and navigate to `http://localhost:3000`. You will be prompted to enter your Pi-hole password.

## How It Works

-   The Python Flask server starts and serves the web interface.
-   The first time you visit, you are presented with a login screen. The server validates the entered password against the one in your `.env` file and creates a secure session.
-   Once logged in, the frontend makes a request to the server's `/api/domains` endpoint.
-   The server queries the Pi-hole API to get a list of all configured domains.
-   The frontend filters these domains to find any that have a `#tag` in their comment and displays a button for each unique tag.
-   You select a tag and a duration.
-   When you click "Unblock", the frontend sends the corresponding Domain IDs and duration to the server's `/api/disable-domain` endpoint.
-   The server disables each selected domain in Pi-hole and sets a timer for each one.
-   When a timer expires, the server automatically re-enables the corresponding domain, restoring its blocking rule.