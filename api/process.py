from fastapi import FastAPI
from api.analyze import analyze

app = FastAPI()
app.post('/api/process')(analyze)
