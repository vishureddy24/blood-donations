# BLOOD DONOR MANAGEMENT SYSTEM

A beginner-friendly one-page blood donor management system built with Node.js, Express, MongoDB, and Socket.IO.

## Project Purpose
This project helps manage blood donors by allowing users to register donors, search them, filter by blood group, update donor availability, and delete donor records. The app stores donor data in MongoDB and updates connected browser clients in real time.

## Technologies Used
- HTML
- CSS
- JavaScript
- Node.js
- Express.js
- MongoDB Atlas
- MongoDB Node.js driver
- Socket.IO

## MongoDB Setup
1. Create a MongoDB Atlas account.
2. Create a cluster and a database.
3. Get your connection string.
4. Create a `.env` file in the project root.
5. Add your MongoDB URI:

```bash
MONGODB_URI=your_mongodb_connection_string
PORT=3000
```

## How to Create `.env`
Create a file named `.env` in the project root with:

```bash
MONGODB_URI=your_mongodb_connection_string
PORT=3000
```

Do not expose your MongoDB username and password in frontend code.

## How to Run the Project
```bash
npm install
npm start
```

Open:

```text
http://localhost:3000
```

## API Endpoints
- `GET /api/donors` - Get all donors
- `POST /api/donors` - Add a new donor
- `PUT /api/donors/:id` - Update donor details or availability
- `DELETE /api/donors/:id` - Delete a donor

Example success response:

```json
{
  "success": true,
  "message": "Donor registered successfully"
}
```

## Real-time Socket.IO
The app uses Socket.IO to broadcast donor updates to all connected users. When a donor is added, updated, or deleted, connected browsers receive updates immediately without refreshing the page.

Events used:
- `donor:created`
- `donor:updated`
- `donor:deleted`

## Simple Project Flow
```text
Frontend form
  -> POST /api/donors
  -> Express backend
  -> MongoDB database
  -> Socket.IO event
  -> All connected clients update instantly
```

