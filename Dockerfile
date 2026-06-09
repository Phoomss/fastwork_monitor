FROM node:20-alpine

WORKDIR /app

# Copy the monitor script and HTML UI
COPY fastwork_monitor.js index.html .

# Make sure seen_jobs.json and matched_jobs.json can be read/written by the node user
# We will create empty files first if they don't exist to prevent Docker from creating folders during mounting
RUN touch seen_jobs.json matched_jobs.json && chown node:node seen_jobs.json matched_jobs.json fastwork_monitor.js index.html

# Expose port 3000
EXPOSE 3000

# Use non-root node user for security
USER node

# Start the monitor
CMD ["node", "fastwork_monitor.js"]
