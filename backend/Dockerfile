FROM node 

WORKDIR '/backapp'   

COPY package.json . 

RUN npm install 

COPY . .  

EXPOSE 5000 

CMD [ "node", "server.js" ]
