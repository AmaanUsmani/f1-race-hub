FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy all frontend static files
COPY index.html .
COPY css/ /usr/share/nginx/html/css/
COPY js/  /usr/share/nginx/html/js/
COPY img/ /usr/share/nginx/html/img/

EXPOSE 80
