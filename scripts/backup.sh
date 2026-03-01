#!/usr/bin/bash

cd $HOME/Development/MindLedger/backups/

docker exec -it mindledger-db bash -c "cd tmp/ && pg_dump -U admin -d mindledger_db > backup.sql"
docker cp mindledger-db:/tmp/backup.sql .
