import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import connectDB from './config/db.js';
import morgan from 'morgan';
import helmet from 'helmet';
import { notFound, errorHandler } from './middleware/errorHandler.js';

// Config
dotenv.config();

// Connect to Database
await connectDB();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Allow all origins for simplicity in development (Flutter app)
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Make io accessible from controllers
app.set('io', io);

// Routes Import (Placeholders for now)
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import postRoutes from './routes/postRoutes.js';
import matchRoutes from './routes/matchRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import expertRoutes from './routes/expertRoutes.js';
import inviteRoutes from './routes/inviteRoutes.js';
import premiumRoutes from './routes/premiumRoutes.js';
import adventureRoutes from './routes/adventureRoutes.js';
import nomadLogRoutes from './routes/nomadLogRoutes.js';
import storyRoutes from './routes/storyRoutes.js';

// ── Routes Usage ──
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/match', matchRoutes); // Connect Feature
app.use('/api/chat', chatRoutes);   // Chat Feature
app.use('/api/experts', expertRoutes); // Build Feature
app.use('/api/invite', inviteRoutes);
app.use('/api/premium', premiumRoutes); // Premium/Subscription Feature
app.use('/api/adventures', adventureRoutes); // Adventures Feature
app.use('/api/nomad-logs', nomadLogRoutes); // Nomad Log Feature
app.use('/api/stories', storyRoutes); // Stories Feature

// Base Route
app.get('/', (req, res) => {
    res.send('Atlas (VanTribe) Backend AI is Running...');
});

// Health Check Endpoint for deployment verification
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0'
    });
});

// ── Error handling (must be AFTER all routes) ──
app.use(notFound);
app.use(errorHandler);

// WebSocket Connection Logic
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Join a specific room (e.g. for a match or direct message)
    socket.on('join_room', (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room: ${roomId}`);
    });

    // Leave a specific room
    socket.on('leave_room', (roomId) => {
        socket.leave(roomId);
        console.log(`User ${socket.id} left room: ${roomId}`);
    });

    // ── Atlas Map: real-time location sharing ──
    socket.on('join_atlas', () => {
        socket.join('atlas_map');
    });

    socket.on('leave_atlas', () => {
        socket.leave('atlas_map');
    });

    // When a user sends their location, broadcast to everyone on the map
    socket.on('location_update', (data) => {
        // data: { userId, lat, lng, name, handle, profilePhoto, photos, profileIcon, nomadCategory, verificationTier }
        socket.to('atlas_map').emit('nomad_location', data);
    });

    // Send message event
    socket.on('send_message', (data) => {
        // data: { roomId, message, senderId, ... }
        io.to(data.roomId).emit('receive_message', data);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Auto-find available port
const findAvailablePort = async (startPort = 8081) => {
    const net = await import('net');
    return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(startPort, () => {
            const port = server.address().port;
            server.close(() => resolve(port));
        });
        server.on('error', () => {
            resolve(findAvailablePort(startPort + 1));
        });
    });
};

const startServer = async () => {
    const PORT = await findAvailablePort(parseInt(process.env.PORT, 10) || 8081);
    httpServer.listen(PORT, () => {
        console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
        console.log(`📡 Backend URL: http://localhost:${PORT}`);
    });
};

startServer();

// ── Process-level safety nets (prevent crash) ──
process.on('uncaughtException', (err) => {
    console.error('🔥 Uncaught Exception:', err.message);
    console.error(err.stack);
});

process.on('unhandledRejection', (reason) => {
    console.error('🔥 Unhandled Rejection:', reason);
});
