FROM node:20-alpine

WORKDIR /app

# Copy the monitor script
COPY fastwork_monitor.js .

# Make sure seen_jobs.json can be read/written by the node user if it exists
# We will create an empty file first if it doesn't exist to prevent Docker from creating a folder during mounting
RUN touch seen_jobs.json && chown node:node seen_jobs.json fastwork_monitor.js

# Use non-root node user for security
USER node

# Start the monitor
CMD ["node", "fastwork_monitor.js"]
