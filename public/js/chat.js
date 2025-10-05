const socket = io();
const form = document.getElementById('chat-form');
const msgInput = document.getElementById('msg');
const messages = document.getElementById('messages');

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const message = msgInput.value.trim();
  if (!message) return;

  socket.emit('chatMessage', {
    senderId: SENDER_ID,
    receiverId: RECEIVER_ID,
    message
  });

  msgInput.value = '';
});

socket.on('chatMessage', (data) => {
  const li = document.createElement('li');
  li.textContent = `${data.senderId}: ${data.message}`;
  messages.appendChild(li);
});
