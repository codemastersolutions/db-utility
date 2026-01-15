#!/bin/bash

# Start SQL Server in the background
/opt/mssql/bin/sqlservr &
pid=$!

# Wait for MSSQL to be ready
echo "Waiting for MS SQL to be ready..."
# sqlcmd in mssql-tools18 might require -C (TrustServerCertificate) for default self-signed certs
until /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -Q "SELECT 1" &> /dev/null
do
    echo "SQL Server is not ready yet..."
    sleep 2
done

echo "MS SQL is ready. Running initialization script..."
/opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -i /docker-entrypoint-initdb.d/setup.sql

echo "Initialization complete. Waiting for SQL Server process..."
wait $pid
