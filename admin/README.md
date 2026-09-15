## 调试

/sys/login
```
curl -X POST http://localhost:7000/sys/login -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"13551458597a\"}"
```

/ad/admin/list
```
curl -X GET http://localhost:7000/ad/admin/list -H "Content-Type: application/json" -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZV9pZCI6MSwiaWF0IjoxNzg5NDc3OTUzLCJleHAiOjE3OTAwODI3NTN9.ldzNRBFsIHtqfax0tIuYprDxO6A1RoseRs7Q6NwOa3I"
```

/ad/admin/detail/{id}
```
curl -X GET http://localhost:7000/ad/admin/detail/3 -H "Content-Type: application/json" -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZV9pZCI6MSwiaWF0IjoxNzg5NDc3OTUzLCJleHAiOjE3OTAwODI3NTN9.ldzNRBFsIHtqfax0tIuYprDxO6A1RoseRs7Q6NwOa3I"
```