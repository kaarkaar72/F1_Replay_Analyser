import requests
import dotenv
import os


token_url = "https://api.openf1.org/token"
payload = {
    "username": "kaarujan2000@gmail.com",
    "password": "5jwG77DWAX8j3w8u"
}
dotenv_file = ".env" 
headers = {
    "Content-Type": "application/x-www-form-urlencoded"
}

response = requests.post(token_url, data=payload, headers=headers)

if response.status_code == 200:
    token_data = response.json()
    print(f"Access token: {token_data.get('access_token')}")
    print(f"Expires in: {token_data.get('expires_in')} seconds")
    dotenv.set_key(dotenv_file, "F1_ACCESS_TOKEN", token_data.get('access_token'))
    print(f"New token loaded into environment: {os.getenv('ACCESS_TOKEN')}")
else:
    print(f"Error obtaining token: {response.status_code} - {response.text}")

