import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import config from './config.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import orgRoutes from './routes/org.js';
import taskRoutes from './routes/task.js';
import indicatorRoutes from './routes/indicator.js';
import milestoneRoutes from './routes/milestone.js';
import reportRoutes from './routes/report.js';
import alertRoutes from './routes/alert.js';
import adhocRoutes from './routes/adhoc.js';
import auditRoutes from './routes/audit.js';

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/orgs', orgRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/indicators', indicatorRoutes);
app.use('/api/milestones', milestoneRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/adhoc-tasks', adhocRoutes);
app.use('/api/audit-logs', auditRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(config.server.port, () => {
  console.log(`SISM Server running on http://localhost:${config.server.port}`);
});
