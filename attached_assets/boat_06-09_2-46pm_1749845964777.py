
import requests
url = 'https://ezeleis-webendpoint.sandbox.landing.ai/inference'
data = {
  '{{your_param_name}}': '{{your_image_url}}'
}
headers = {
  "Authorization": "Basic {{your_api_key}}"
}
response = requests.post(url, data=data, headers=headers)
print(response.status_code)
print(response.json())
