import wave
import os

kits = ['808', 'rock']
sounds = ['kick.wav', 'snare.wav', 'closed_hat.wav', 'open_hat.wav']

for kit in kits:
    os.makedirs(f'public/kits/{kit}', exist_ok=True)
    for sound in sounds:
        path = f'public/kits/{kit}/{sound}'
        with wave.open(path, 'w') as f:
            f.setnchannels(1)
            f.setsampwidth(2)
            f.setframerate(44100)
            f.writeframes(b'\x00' * 8820) # 0.1 seconds of silence
