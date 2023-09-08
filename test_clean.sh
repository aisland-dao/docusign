#!/bin/bash
mysql <test_clean_database.sql
rm upload/026af8f3fb5f70e10361b31506833b30
rm upload/59af0e234e8b79f13100d360131a563d
echo "Database has been cleaned"
