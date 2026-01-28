import requests

def verify_gemini_api_key(api_key):
    url = "https://generativelanguage.googleapis.com/v1/models"
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": api_key  # Secure way to pass the key
    }
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        print("Valid API key.")
        return True
    else:
        error_msg = response.json().get("error", {}).get("message", "Invalid API key")
        print(f"Invalid or restricted API key: {error_msg}")
        return False

# Replace with your actual API key
verify_gemini_api_key("AIzaSyAkm6VkNZ0KruI2UvQtG5Sy_f2S3ku-4UI") 

import google.genai as genai

client = genai.Client(api_key="AIzaSyAkm6VkNZ0KruI2UvQtG5Sy_f2S3ku-4UI")

for model in client.models.list():
    # Check if model supports generateContent
    if hasattr(model, 'supported_actions') and 'generateContent' in model.supported_actions:
        print(model.name)