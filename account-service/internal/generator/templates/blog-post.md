# [[.Post.Title]]

> [[if .Post.Excerpt]][[.Post.Excerpt]][[end]]

- **Author:** [[.Post.Author]]
- **Published:** [[.Post.PublishedAt.Format "January 2, 2006"]]
- **Category:** [[.Post.Category]]
- **Read time:** ~[[.Post.ReadMinutes]] min
- **URL:** https://[[.Domain]]/blog/[[.Post.Filename]].html
- **Site:** [[.Company.Name]] (https://[[.Domain]]/)

---

[[.Post.Body]]

---
[[if .Post.AuthorBio]]
**About the author:** [[.Post.AuthorBio]]
[[end]]
[[if .RelatedPosts]]
## Related articles
[[range .RelatedPosts]]
- [[.Title]] — https://[[$.Domain]]/blog/[[.Filename]].html
[[end]][[end]]

Last updated: [[.Post.UpdatedAt.Format "2006-01-02"]]
