FROM node:lts

COPY . .

RUN npm install --save-dev @types/express
RUN npm run build

EXPOSE 3000
CMD ["node", "dist/src/server/main.js"]
