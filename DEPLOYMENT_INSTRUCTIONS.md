# 🚀 How to Host Your Bus Tracker on Render

You are almost there! I have prepared your code. Now you just need to put it online.

## Step 1: Put Code on GitHub
1.  Log in to [GitHub.com](https://github.com).
2.  Click the **+** icon in the top right -> **New repository**.
3.  Repository name: `bus-tracker` (or anything you like).
4.  Public or Private: **Public** is easier (Private works too but might require settings).
5.  **Do not** check "Add a README" or .gitignore (I already made them).
6.  Click **Create repository**.
7.  Copy the URL showing `https://github.com/YOUR_USERNAME/bus-tracker.git`.

## Step 2: Push Your Code
Open your terminal (Command Prompt) in this folder and run these 3 commands:
*(Replace the URL with your actual GitHub URL)*

```powershell
git remote add origin https://github.com/YOUR_USERNAME/bus-tracker.git
git branch -M main
git push -u origin main
```

## Step 3: Deploy on Render
1.  Go to [dashboard.render.com](https://dashboard.render.com/).
2.  Click **New +** -> **Web Service**.
3.  Connect your GitHub account if asked.
4.  Select your `bus-tracker` repository.
5.  Settings:
    *   **Name**: `my-bus-tracker`
    *   **Region**: Any (Singapore is usually fast for Asia).
    *   **Branch**: `main`
    *   **Runtime**: Python 3
    *   **Build Command**: `pip install -r requirements.txt` (Default is correct)
    *   **Start Command**: `gunicorn -k eventlet -w 1 app:app` (This MUST match my file)
    *   **Instance Type**: Free
6.  Click **Create Web Service**.

## Step 4: Add Environment Variables (IMPORTANT)
1.  On your Render Dashboard for the new service, finding the **Environment** tab on the left.
2.  Click **Add Environment Variable**.
3.  Add the AI Key:
    *   **Key**: `GROQ_API_KEY`
    *   **Value**: (Paste your `gsk_...` key here)
4.  Click **Save Changes**.

## Step 5: Test in the Bus!
*   Wait about 3-5 minutes for the build to finish.
*   You will see a link like `https://my-bus-tracker.onrender.com`.
*   **Open this link on the Driver's phone** (and your phone).
*   Go to `/driver` on the driver's phone and start sharing!
