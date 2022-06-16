FROM    ubuntu:20.04
ARG    	DEBIAN_FRONTEND=noninteractive
RUN     apt-get update
RUN     apt-get -y upgrade 
RUN   	apt-get -y install curl

# node version 14.x for using mongoDB
RUN	    curl -sL https://deb.nodesource.com/setup_14.x | bash -
RUN     apt-get -y install nodejs

# git setting
RUN     apt-get -y install git
RUN     git clone https://github.com/Stageus/outsourcing-knock-backend.git

RUN     apt-get install -y vim

# WORKDIR /
